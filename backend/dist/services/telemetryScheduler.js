import { pool } from "../db/postgres.js";
/**
 * Telemetry Scheduler — 2 000 ms cadence.
 *
 * Inserts one new sensor_readings row per robot every 2 seconds.
 *
 * Generation model (per robot, per channel):
 *   NORMAL mode  — bounded random walk + mean reversion
 *   ANOMALY mode — value driven toward a target excursion for N ticks,
 *                  then gradually recovered back to normal
 *
 * This produces:
 *   • frequent small irregular fluctuations
 *   • occasional moderate peaks / drops lasting several readings
 *   • rare sharper spikes
 *   • smooth recovery (not instantaneous jump back)
 *   • no repeating cycle, no saw-tooth, no sine wave
 *   • independent behaviour across the four channels
 *   • loose partial correlation: load spike can raise temp + current together
 *
 * The same code runs for every robot — no robot-name branches.
 */
const CADENCE_MS = 2_000;
// Fleet-wide channel specs — every robot uses these, shifted by a small
// per-robot baseline offset so each unit has its own operating band.
const CHANNEL_SPEC = {
    temp: {
        mean: 61.5, // °C — centre of spec 60–63 °C normal band
        noise: 0.18, // ~0.18 °C per tick
        revStr: 0.04,
        hardMin: 45,
        hardMax: 95,
        anomalyMod: 3.0, // moderate: +3 °C (reaches ~64–65 °C)
        anomalySharp: 7.0, // sharp:    +7 °C (brief thermal spike)
    },
    vib: {
        mean: 2.5, // mm/s
        noise: 0.04,
        revStr: 0.06,
        hardMin: 0.1,
        hardMax: 9.0,
        anomalyMod: 1.0,
        anomalySharp: 2.5,
    },
    cur: {
        mean: 11.5, // A
        noise: 0.22,
        revStr: 0.05,
        hardMin: 4.0,
        hardMax: 35.0,
        anomalyMod: 3.5,
        anomalySharp: 8.0,
    },
    pres: {
        mean: 5.0, // bar
        noise: 0.025,
        revStr: 0.08,
        hardMin: 2.0,
        hardMax: 9.0,
        anomalyMod: 0.8,
        anomalySharp: 1.8,
    },
};
const states = new Map();
// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Two-uniform triangular noise — good approximation to Gaussian at low cost */
function triangleNoise(scale) {
    return (Math.random() + Math.random() - 1.0) * scale;
}
/** Bounded random walk step with mean reversion — no anomaly */
function walkStep(prev, effectiveMean, spec, hardMin, hardMax) {
    const noise = triangleNoise(spec.noise);
    const reversion = (effectiveMean - prev) * spec.revStr;
    const next = prev + noise + reversion;
    return Math.max(hardMin, Math.min(hardMax, parseFloat(next.toFixed(2))));
}
/**
 * Decide whether to start a new anomaly event on this tick.
 * Returns a new AnomalyEvent or null.
 *
 * Probability breakdown (per channel, per tick):
 *   ~2 %  moderate event  (lasts 3–8 ticks)
 *   ~0.5% sharp event     (lasts 2–4 ticks)
 */
function maybeStartAnomaly(current, mean, spec, hardMin, hardMax) {
    const r = Math.random();
    if (r > 0.025)
        return null; // 97.5 % — nothing happens
    const isSharp = r < 0.005; // the bottom 0.5 % get a sharp event
    const magnitude = isSharp ? spec.anomalySharp : spec.anomalyMod;
    const sign = Math.random() > 0.35 ? 1 : -1; // bias upward slightly (heat/load)
    const pushTicks = isSharp
        ? 2 + Math.floor(Math.random() * 3) // 2–4 ticks
        : 3 + Math.floor(Math.random() * 6); // 3–8 ticks
    const target = Math.max(hardMin, Math.min(hardMax, current + sign * magnitude));
    return { target, pushTicks, pushed: 0, recovering: false };
}
/**
 * Advance one channel value by one tick, honouring any active anomaly event.
 * Mutates `event` in place; sets it to null when the recovery ends.
 */
function advanceChannel(prev, effectiveMean, spec, hardMin, hardMax, event, setEvent) {
    if (event === null) {
        // Normal walk
        return walkStep(prev, effectiveMean, spec, hardMin, hardMax);
    }
    if (!event.recovering) {
        // Push phase: nudge value toward target
        const remaining = event.target - prev;
        // Move roughly 1/pushTicks of the way per tick, plus normal noise
        const step = remaining / Math.max(1, event.pushTicks - event.pushed)
            + triangleNoise(spec.noise * 0.5);
        const next = Math.max(hardMin, Math.min(hardMax, parseFloat((prev + step).toFixed(2))));
        event.pushed += 1;
        if (event.pushed >= event.pushTicks) {
            event.recovering = true;
        }
        return next;
    }
    // Recovery phase: stronger mean reversion so it comes back naturally but
    // not instantly — reversion strength 3× normal.
    const noise = triangleNoise(spec.noise);
    const reversion = (effectiveMean - prev) * (spec.revStr * 3);
    const next = Math.max(hardMin, Math.min(hardMax, parseFloat((prev + noise + reversion).toFixed(2))));
    // End recovery once we are within 1 noise-step of the mean
    if (Math.abs(next - effectiveMean) < spec.noise * 2) {
        setEvent(null);
    }
    return next;
}
// ─── Initialisation ──────────────────────────────────────────────────────────
async function initStates() {
    // Latest sensor reading per robot
    const latestRes = await pool.query(`
        WITH ranked AS (
            SELECT
                sr.robot_id,
                r.name              AS robot_name,
                sr.temperature_c,
                sr.vibration_mm_s,
                sr.motor_current_a,
                sr.pressure_bar,
                ROW_NUMBER() OVER (
                    PARTITION BY sr.robot_id
                    ORDER BY sr.recorded_at DESC
                ) AS rn
            FROM sensor_readings sr
            JOIN robots r ON r.id = sr.robot_id
        )
        SELECT robot_id, robot_name, temperature_c, vibration_mm_s,
               motor_current_a, pressure_bar
        FROM ranked
        WHERE rn = 1;
    `);
    // All robots (including those with no readings yet)
    const allRobots = await pool.query(`SELECT id AS robot_id, name AS robot_name FROM robots ORDER BY name;`);
    const latestMap = new Map(latestRes.rows.map((r) => [r.robot_id, r]));
    for (const { robot_id, robot_name } of allRobots.rows) {
        // Deterministic per-robot baseline offset from name hash
        // (stable across restarts; small spread so all robots stay in realistic range)
        let hash = 5381;
        for (let i = 0; i < robot_name.length; i++) {
            hash = ((hash << 5) + hash) ^ robot_name.charCodeAt(i);
            hash = hash & 0xffff;
        }
        const offsets = {
            temp: ((hash % 61) - 30) * 0.1, // ± 3 °C
            vib: ((hash % 41) - 20) * 0.02, // ± 0.4 mm/s
            cur: ((hash % 51) - 25) * 0.1, // ± 2.5 A
            pres: ((hash % 31) - 15) * 0.02, // ± 0.3 bar
        };
        const latest = latestMap.get(robot_id);
        const spec = CHANNEL_SPEC;
        states.set(robot_id, {
            robotId: robot_id,
            robotName: robot_name,
            offsets,
            temp: latest ? Number(latest.temperature_c) : spec.temp.mean + offsets.temp,
            vib: latest ? Number(latest.vibration_mm_s) : spec.vib.mean + offsets.vib,
            cur: latest ? Number(latest.motor_current_a) : spec.cur.mean + offsets.cur,
            pres: latest ? Number(latest.pressure_bar) : spec.pres.mean + offsets.pres,
            tempAnomaly: null,
            vibAnomaly: null,
            curAnomaly: null,
            presAnomaly: null,
            tick: 0,
        });
    }
    console.log(`[Telemetry] Initialised state for ${states.size} robot(s).`);
}
// ─── Per-tick computation ────────────────────────────────────────────────────
function computeNextValues(s) {
    const sp = CHANNEL_SPEC;
    // Effective means = fleet mean ± per-robot offset
    const tempMean = sp.temp.mean + s.offsets.temp;
    const vibMean = sp.vib.mean + s.offsets.vib;
    const curMean = sp.cur.mean + s.offsets.cur;
    const presMean = sp.pres.mean + s.offsets.pres;
    // ── Attempt to start new anomaly events (only when no event is active) ───
    if (s.tempAnomaly === null) {
        s.tempAnomaly = maybeStartAnomaly(s.temp, tempMean, sp.temp, sp.temp.hardMin, sp.temp.hardMax);
    }
    if (s.vibAnomaly === null) {
        s.vibAnomaly = maybeStartAnomaly(s.vib, vibMean, sp.vib, sp.vib.hardMin, sp.vib.hardMax);
    }
    if (s.curAnomaly === null) {
        s.curAnomaly = maybeStartAnomaly(s.cur, curMean, sp.cur, sp.cur.hardMin, sp.cur.hardMax);
    }
    if (s.presAnomaly === null) {
        s.presAnomaly = maybeStartAnomaly(s.pres, presMean, sp.pres, sp.pres.hardMin, sp.pres.hardMax);
    }
    // ── Loose partial correlation: if a current anomaly fires, co-excite temp ─
    // (models: high motor load → slightly elevated temperature)
    // This is probabilistic and partial — not perfectly synchronised.
    if (s.curAnomaly !== null && !s.curAnomaly.recovering
        && s.tempAnomaly === null && Math.random() < 0.35) {
        const sign = s.curAnomaly.target > curMean ? 1 : -1;
        const coTarget = Math.max(sp.temp.hardMin, Math.min(sp.temp.hardMax, tempMean + sign * sp.temp.anomalyMod * 0.5));
        s.tempAnomaly = {
            target: coTarget,
            pushTicks: 2 + Math.floor(Math.random() * 3),
            pushed: 0,
            recovering: false,
        };
    }
    // ── Advance each channel ─────────────────────────────────────────────────
    const newTemp = advanceChannel(s.temp, tempMean, sp.temp, sp.temp.hardMin, sp.temp.hardMax, s.tempAnomaly, (e) => { s.tempAnomaly = e; });
    const newVib = advanceChannel(s.vib, vibMean, sp.vib, sp.vib.hardMin, sp.vib.hardMax, s.vibAnomaly, (e) => { s.vibAnomaly = e; });
    const newCur = advanceChannel(s.cur, curMean, sp.cur, sp.cur.hardMin, sp.cur.hardMax, s.curAnomaly, (e) => { s.curAnomaly = e; });
    const newPres = advanceChannel(s.pres, presMean, sp.pres, sp.pres.hardMin, sp.pres.hardMax, s.presAnomaly, (e) => { s.presAnomaly = e; });
    // Persist
    s.temp = newTemp;
    s.vib = newVib;
    s.cur = newCur;
    s.pres = newPres;
    s.tick += 1;
    return {
        temperature_c: newTemp,
        vibration_mm_s: newVib,
        motor_current_a: newCur,
        pressure_bar: newPres,
    };
}
// ─── Tick loop ───────────────────────────────────────────────────────────────
async function telemetryTick() {
    if (states.size === 0) {
        try {
            await initStates();
        }
        catch (err) {
            console.error("[Telemetry] Failed to init states:", err instanceof Error ? err.message : err);
            return;
        }
    }
    for (const [, s] of states) {
        const vals = computeNextValues(s);
        try {
            const res = await pool.query(`INSERT INTO sensor_readings
                    (robot_id, temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 RETURNING recorded_at`, [s.robotId, vals.temperature_c, vals.vibration_mm_s, vals.motor_current_a, vals.pressure_bar]);
            const ts = res.rows[0]?.recorded_at;
            console.log(`[Telemetry] robot=${s.robotId} name=${s.robotName} ` +
                `ts=${ts instanceof Date ? ts.toISOString() : ts} ` +
                `temp=${vals.temperature_c} vib=${vals.vibration_mm_s} ` +
                `cur=${vals.motor_current_a} pres=${vals.pressure_bar}`);
        }
        catch (err) {
            console.error(`[Telemetry] INSERT failed for robot ${s.robotId}:`, err instanceof Error ? err.message : err);
        }
    }
}
// ─── Public API ──────────────────────────────────────────────────────────────
let intervalHandle = null;
export function startTelemetryScheduler() {
    if (intervalHandle !== null) {
        console.warn("[Telemetry] Scheduler already running — skipping duplicate start.");
        return;
    }
    intervalHandle = setInterval(() => { void telemetryTick(); }, CADENCE_MS);
    console.log(`✓ Telemetry scheduler started (cadence: ${CADENCE_MS} ms)`);
}
export function stopTelemetryScheduler() {
    if (intervalHandle !== null) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log("[Telemetry] Scheduler stopped.");
    }
}
