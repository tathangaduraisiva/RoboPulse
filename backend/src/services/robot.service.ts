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

/**
 * Authoritative single-source-of-truth robot status calculator.
 *
 * Evaluates real-time state for any robot across:
 * 1. Active (unresolved) alerts
 * 2. Active or overdue maintenance records
 * 3. Live telemetry connectivity and recency
 *
 * Applicable universally to all robots (ROBOT-001 through ROBOT-008).
 */
export async function getCurrentRobotStatus(robotId: string): Promise<RobotStatusType> {
    // 1. Check for active (unresolved) alerts
    const alertsRes = await pool.query(
        `SELECT type, severity, status
         FROM alerts
         WHERE robot_id = $1
           AND status NOT IN ('resolved')
         ORDER BY created_at DESC;`,
        [robotId]
    );

    const activeAlerts = alertsRes.rows;

    // Check for active Offline alert
    const hasOfflineAlert = activeAlerts.some(
        (a) => a.type?.toLowerCase() === "offline"
    );
    if (hasOfflineAlert) {
        return "offline";
    }

    // 2. Check telemetry recency (connectivity health)
    const telemetryRes = await pool.query(
        `SELECT recorded_at
         FROM sensor_readings
         WHERE robot_id = $1
         ORDER BY recorded_at DESC
         LIMIT 1;`,
        [robotId]
    );

    if (telemetryRes.rows.length === 0) {
        // No telemetry data found at all
        return "offline";
    }

    const latestReadingAt = new Date(telemetryRes.rows[0].recorded_at).getTime();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (isNaN(latestReadingAt) || latestReadingAt < oneHourAgo) {
        // Telemetry stream has stopped reporting
        return "offline";
    }

    // 3. Check for active or overdue maintenance
    const maintRes = await pool.query(
        `SELECT id, maintenance_type, performed_at, next_due_at, condition_handled_at
         FROM maintenance_records
         WHERE robot_id = $1
         ORDER BY created_at DESC;`,
        [robotId]
    );

    const hasActiveMaintenance = maintRes.rows.some((m) => {
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

    if (hasActiveMaintenance) {
        return "maintenance";
    }

    // 4. Check for active unresolved anomaly alerts (critical, high, medium, low)
    if (activeAlerts.length > 0) {
        return "attention";
    }

    // 5. Default healthy condition
    return "operational";
}

/**
 * Synchronizes the persisted status of a single robot in PostgreSQL and invalidates caches.
 */
export async function syncRobotStatus(robotId: string): Promise<RobotStatusType> {
    const calculatedStatus = await getCurrentRobotStatus(robotId);

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