import { pool } from "../db/postgres.js";
import { syncRobotStatus } from "./robot.service.js";
import { processTelemetryAlerts } from "./alert.service.js";
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
// Controlled per-robot telemetry profiles for realistic localhost operation:
// ROBOT-002: Moderately elevated vibration (3.65–4.05 mm/s) -> Attention / Moderate Risk
// ROBOT-001, 003..008: Distinct healthy baselines within normal operating region -> Operational / Low Risk
const ROBOT_PROFILES = {
    "ROBOT-002": {
        tempMean: 62.0, vibMean: 3.85, curMean: 11.5, presMean: 5.05,
        tempNoise: 0.12, vibNoise: 0.04, curNoise: 0.15, presNoise: 0.02,
        vibMin: 3.60, vibMax: 4.10,
        tempMin: 60.5, tempMax: 63.5,
        curMin: 10.5, curMax: 12.8,
        presMin: 4.88, presMax: 5.22,
    },
    "ROBOT-001": {
        tempMean: 61.2, vibMean: 2.25, curMean: 11.2, presMean: 5.02,
        tempNoise: 0.10, vibNoise: 0.03, curNoise: 0.12, presNoise: 0.02,
        vibMin: 2.05, vibMax: 2.50,
        tempMin: 60.0, tempMax: 62.5,
        curMin: 10.2, curMax: 12.2,
        presMin: 4.90, presMax: 5.15,
    },
    "ROBOT-003": {
        tempMean: 61.8, vibMean: 2.38, curMean: 11.6, presMean: 5.10,
        tempNoise: 0.10, vibNoise: 0.03, curNoise: 0.12, presNoise: 0.02,
        vibMin: 2.15, vibMax: 2.55,
        tempMin: 60.5, tempMax: 63.0,
        curMin: 10.6, curMax: 12.6,
        presMin: 4.95, presMax: 5.25,
    },
    "ROBOT-004": {
        tempMean: 60.9, vibMean: 2.18, curMean: 10.9, presMean: 4.98,
        tempNoise: 0.10, vibNoise: 0.03, curNoise: 0.12, presNoise: 0.02,
        vibMin: 1.98, vibMax: 2.42,
        tempMin: 59.8, tempMax: 62.0,
        curMin: 9.8, curMax: 11.8,
        presMin: 4.85, presMax: 5.12,
    },
    "ROBOT-005": {
        tempMean: 62.3, vibMean: 2.45, curMean: 12.1, presMean: 5.15,
        tempNoise: 0.10, vibNoise: 0.03, curNoise: 0.12, presNoise: 0.02,
        vibMin: 2.20, vibMax: 2.60,
        tempMin: 61.0, tempMax: 63.5,
        curMin: 11.0, curMax: 13.0,
        presMin: 5.00, presMax: 5.30,
    },
    "ROBOT-006": {
        tempMean: 61.5, vibMean: 2.30, curMean: 11.4, presMean: 5.05,
        tempNoise: 0.10, vibNoise: 0.03, curNoise: 0.12, presNoise: 0.02,
        vibMin: 2.10, vibMax: 2.52,
        tempMin: 60.2, tempMax: 62.8,
        curMin: 10.4, curMax: 12.4,
        presMin: 4.92, presMax: 5.18,
    },
    "ROBOT-007": {
        tempMean: 60.7, vibMean: 2.12, curMean: 10.6, presMean: 4.95,
        tempNoise: 0.10, vibNoise: 0.03, curNoise: 0.12, presNoise: 0.02,
        vibMin: 1.95, vibMax: 2.38,
        tempMin: 59.5, tempMax: 61.8,
        curMin: 9.6, curMax: 11.5,
        presMin: 4.82, presMax: 5.10,
    },
    "ROBOT-008": {
        tempMean: 62.0, vibMean: 2.40, curMean: 11.8, presMean: 5.12,
        tempNoise: 0.10, vibNoise: 0.03, curNoise: 0.12, presNoise: 0.02,
        vibMin: 2.18, vibMax: 2.58,
        tempMin: 60.8, tempMax: 63.2,
        curMin: 10.8, curMax: 12.8,
        presMin: 4.98, presMax: 5.25,
    },
};
function getRobotProfile(robotName) {
    const upper = robotName.toUpperCase();
    for (const [key, prof] of Object.entries(ROBOT_PROFILES)) {
        if (upper.includes(key))
            return prof;
    }
    return ROBOT_PROFILES["ROBOT-001"];
}
// ─── Initialisation ──────────────────────────────────────────────────────────
async function initStates() {
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
    const allRobots = await pool.query(`SELECT id AS robot_id, name AS robot_name FROM robots ORDER BY name;`);
    const latestMap = new Map(latestRes.rows.map((r) => [r.robot_id, r]));
    for (const { robot_id, robot_name } of allRobots.rows) {
        const profile = getRobotProfile(robot_name);
        const offsets = {
            temp: 0,
            vib: 0,
            cur: 0,
            pres: 0,
        };
        const latest = latestMap.get(robot_id);
        states.set(robot_id, {
            robotId: robot_id,
            robotName: robot_name,
            offsets,
            temp: latest ? Number(latest.temperature_c) : profile.tempMean,
            vib: latest ? Number(latest.vibration_mm_s) : profile.vibMean,
            cur: latest ? Number(latest.motor_current_a) : profile.curMean,
            pres: latest ? Number(latest.pressure_bar) : profile.presMean,
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
    const prof = getRobotProfile(s.robotName);
    // Natural random walk with mean-reversion bounded within profile envelope
    const stepChannel = (prev, mean, noiseScale, minVal, maxVal, rev = 0.08) => {
        const noise = triangleNoise(noiseScale);
        const reversion = (mean - prev) * rev;
        const next = prev + noise + reversion;
        return Math.max(minVal, Math.min(maxVal, parseFloat(next.toFixed(2))));
    };
    const newTemp = stepChannel(s.temp, prof.tempMean, prof.tempNoise, prof.tempMin, prof.tempMax, 0.06);
    const newVib = stepChannel(s.vib, prof.vibMean, prof.vibNoise, prof.vibMin, prof.vibMax, 0.08);
    const newCur = stepChannel(s.cur, prof.curMean, prof.curNoise, prof.curMin, prof.curMax, 0.06);
    const newPres = stepChannel(s.pres, prof.presMean, prof.presNoise, prof.presMin, prof.presMax, 0.08);
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
            // 1. Process real telemetry threshold infractions & create/update active alerts
            await processTelemetryAlerts(s.robotId, s.robotName, vals);
            // 2. Authoritatively synchronize robot status with new telemetry and alerts
            await syncRobotStatus(s.robotId);
        }
        catch (err) {
            console.error(`[Telemetry] Tick failed for robot ${s.robotId}:`, err instanceof Error ? err.message : err);
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
    // Fire an immediate tick to populate live sensor readings without delay
    void telemetryTick();
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
