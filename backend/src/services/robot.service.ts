import { pool } from "../db/postgres.js";
import { redisClient } from "../config/redis.js";

export type RobotStatusType = "operational" | "attention" | "maintenance" | "offline";

/**
 * Invalidates robot-related Redis caches for a single robot or the entire fleet.
 */
export async function invalidateRobotCache(robotId?: string): Promise<void> {
    try {
        if (redisClient.isOpen) {
            await redisClient.del("robots:all");
            await redisClient.del("predictions:all");
            if (robotId) {
                await redisClient.del(`robots:${robotId}`);
                await redisClient.del(`prediction:robot:${robotId}`);
            }
        }
    } catch (err) {
        console.warn("[RobotService] Redis cache invalidation error:", err);
    }
}

export interface RobotStatusDetails {
    status: RobotStatusType;
    reason: string;
}

/**
 * Authoritative single-source-of-truth robot status calculator with detailed rationale.
 *
 * Evaluates real-time state for any robot across:
 * 1. Active (unresolved) alerts
 * 2. Active or overdue maintenance records
 * 3. Live telemetry connectivity, recency, and operating thresholds
 *
 * Applicable universally to all robots (ROBOT-001 through ROBOT-008).
 */
export async function getCurrentRobotStatusDetails(robotId: string): Promise<RobotStatusDetails> {
    // 1. Check telemetry recency (connectivity health)
    const telemetryRes = await pool.query(
        `SELECT recorded_at, temperature_c, vibration_mm_s, motor_current_a, pressure_bar
         FROM sensor_readings
         WHERE robot_id = $1
         ORDER BY recorded_at DESC
         LIMIT 1;`,
        [robotId]
    );

    if (telemetryRes.rows.length === 0) {
        // No telemetry data found at all
        return {
            status: "offline",
            reason: "no telemetry data recorded",
        };
    }

    const latest = telemetryRes.rows[0];
    const latestReadingAt = new Date(latest.recorded_at).getTime();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (isNaN(latestReadingAt) || latestReadingAt < oneHourAgo) {
        // Telemetry stream has stopped reporting
        return {
            status: "offline",
            reason: `stale telemetry stream (last reading at ${new Date(latest.recorded_at).toISOString()})`,
        };
    }

    // Telemetry is live: auto-resolve any prior 'Offline' alert
    await pool.query(
        `UPDATE alerts
         SET status = 'resolved', updated_at = NOW()
         WHERE robot_id = $1
           AND LOWER(type) = 'offline'
           AND status != 'resolved';`,
        [robotId]
    );

    // 2. Check for active or overdue maintenance
    const maintRes = await pool.query(
        `SELECT id, maintenance_type, performed_at, next_due_at, condition_handled_at, description
         FROM maintenance_records
         WHERE robot_id = $1
         ORDER BY created_at DESC;`,
        [robotId]
    );

    const activeMaint = maintRes.rows.find((m) => {
        // Overdue maintenance task
        if (m.next_due_at && new Date(m.next_due_at).getTime() < Date.now()) {
            return true;
        }
        // In-progress maintenance (created without completion timestamp)
        if (!m.performed_at && !m.condition_handled_at && !m.next_due_at) {
            return true;
        }
        return false;
    });

    if (activeMaint) {
        const isOverdue = activeMaint.next_due_at && new Date(activeMaint.next_due_at).getTime() < Date.now();
        return {
            status: "maintenance",
            reason: isOverdue
                ? `overdue maintenance task (due: ${new Date(activeMaint.next_due_at).toISOString()})`
                : `active maintenance in progress (${activeMaint.maintenance_type}: ${activeMaint.description || "scheduled"})`,
        };
    }

    // 3. Check for active (unresolved) anomaly alerts
    const alertsRes = await pool.query(
        `SELECT id, type, severity, status, message
         FROM alerts
         WHERE robot_id = $1
           AND status NOT IN ('resolved')
         ORDER BY created_at DESC;`,
        [robotId]
    );

    const activeAlerts = alertsRes.rows;
    if (activeAlerts.length > 0) {
        const alertSummary = activeAlerts.map((a) => `${a.type} [${a.severity}]`).join(", ");
        return {
            status: "attention",
            reason: `active unresolved alert(s): ${alertSummary}`,
        };
    }

    // 4. Check for abnormal sensor telemetry exceeding critical thresholds
    const temp = Number(latest.temperature_c) || 0;
    const vib = Number(latest.vibration_mm_s) || 0;
    const curr = Number(latest.motor_current_a) || 0;
    const press = Number(latest.pressure_bar) || 0;

    if (vib > 4.5 || temp > 80 || curr > 22 || press < 4.0 || press > 7.0) {
        return {
            status: "attention",
            reason: `abnormal telemetry exceeding limits (temp=${temp}°C, vib=${vib}mm/s, curr=${curr}A, press=${press}bar)`,
        };
    }

    // 5. Default healthy condition
    const ageSeconds = Math.max(0, Math.round((Date.now() - latestReadingAt) / 1000));
    return {
        status: "operational",
        reason: `healthy recent telemetry (temp=${temp}°C, vib=${vib}mm/s, curr=${curr}A, press=${press}bar, stream age=${ageSeconds}s)`,
    };
}

export async function getCurrentRobotStatus(robotId: string): Promise<RobotStatusType> {
    const details = await getCurrentRobotStatusDetails(robotId);
    return details.status;
}

/**
 * Synchronizes the persisted status of a single robot in PostgreSQL and invalidates caches.
 */
export async function syncRobotStatus(robotId: string): Promise<RobotStatusType> {
    const robotRes = await pool.query(`SELECT id, name, model, status FROM robots WHERE id = $1;`, [robotId]);
    const robot = robotRes.rows[0];
    const robotName = robot ? `${robot.name} (${robot.model})` : robotId;
    const previousStatus = robot?.status;

    const { status: calculatedStatus, reason } = await getCurrentRobotStatusDetails(robotId);

    if (previousStatus !== calculatedStatus) {
        console.log(`[RobotStatusSync] ${robotName} status updated: ${previousStatus ?? "unknown"} -> ${calculatedStatus} | reason: ${reason}`);
    } else {
        console.log(`[RobotStatusSync] ${robotName} status verified: ${calculatedStatus} | reason: ${reason}`);
    }

    await pool.query(
        `UPDATE robots
         SET status = $1
         WHERE id = $2;`,
        [calculatedStatus, robotId]
    );

    await invalidateRobotCache(robotId);
    return calculatedStatus;
}

/**
 * Synchronizes all robots across the fleet in batch.
 */
export async function syncAllRobotStatuses(): Promise<void> {
    try {
        const robotsRes = await pool.query(`SELECT id FROM robots;`);
        for (const row of robotsRes.rows) {
            await syncRobotStatus(row.id);
        }
        await invalidateRobotCache();
    } catch (err) {
        console.error("[RobotService] Failed to sync all robot statuses:", err);
    }
}

export async function getAllRobots() {
    const result = await pool.query(`
        SELECT
            r.id,
            r.line_id,
            r.name,
            r.serial_number,
            r.model,
            r.manufacturer,
            r.status,
            r.installation_date,
            r.total_runtime_hours,
            r.created_at,
            COALESCE(pl.name, 'Unassigned') AS line_name
        FROM robots r
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        ORDER BY r.name;
    `);
    return result.rows;
}

export async function getRobotById(robotId: string) {
    const result = await pool.query(
        `
        SELECT
            r.id,
            r.line_id,
            r.name,
            r.serial_number,
            r.model,
            r.manufacturer,
            r.status,
            r.installation_date,
            r.total_runtime_hours,
            r.created_at,
            COALESCE(pl.name, 'Unassigned') AS line_name
        FROM robots r
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        WHERE r.id = $1
        LIMIT 1;
        `,
        [robotId]
    );
    return result.rows[0] ?? null;
}