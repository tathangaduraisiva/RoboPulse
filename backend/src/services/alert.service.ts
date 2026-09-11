import { pool } from "../db/postgres.js";
import { invalidateRobotPredictionCache } from "./predictionEngine.js";
import { syncRobotStatus } from "./robot.service.js";

export interface AlertRecord {
    id: string;
    robot_id: string;
    robot_name: string;
    robot_serial: string;
    robot_model: string;
    line_name: string;
    anomaly_type: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    status: "new" | "acknowledged" | "in_progress" | "open" | "investigating" | "resolved";
    detected_at: string;
    resolved_at: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface CreateAlertInput {
    robot_id: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    status?: string;
}

export async function getAllAlerts(): Promise<AlertRecord[]> {
    const query = `
        SELECT
            a.id,
            a.robot_id,
            r.name AS robot_name,
            r.serial_number AS robot_serial,
            r.model AS robot_model,
            COALESCE(pl.name, 'Unassigned') AS line_name,
            a.type AS anomaly_type,
            a.severity AS severity,
            a.message AS description,
            a.status AS status,
            a.created_at AS detected_at,
            CASE WHEN a.status = 'resolved' THEN a.updated_at ELSE NULL END AS resolved_at
        FROM alerts a
        JOIN robots r ON a.robot_id = r.id
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        ORDER BY a.created_at DESC;
    `;

    const result = await pool.query(query);
    return result.rows.map((row) => ({
        ...row,
        status: (row.status === 'in_progress' || row.status === 'acknowledged' || row.status === 'investigating')
            ? 'investigating'
            : (row.status === 'resolved')
            ? 'resolved'
            : 'open',
        resolved_at: row.resolved_at ?? null,
    }));
}

export async function getAlertById(id: string): Promise<AlertRecord | null> {
    const query = `
        SELECT
            a.id,
            a.robot_id,
            r.name AS robot_name,
            r.serial_number AS robot_serial,
            r.model AS robot_model,
            COALESCE(pl.name, 'Unassigned') AS line_name,
            a.type AS anomaly_type,
            a.severity AS severity,
            a.message AS description,
            a.status AS status,
            a.created_at AS detected_at,
            CASE WHEN a.status = 'resolved' THEN a.updated_at ELSE NULL END AS resolved_at
        FROM alerts a
        JOIN robots r ON a.robot_id = r.id
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        WHERE a.id = $1;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        ...row,
        status: (row.status === 'in_progress' || row.status === 'acknowledged' || row.status === 'investigating')
            ? 'investigating'
            : (row.status === 'resolved')
            ? 'resolved'
            : 'open',
        resolved_at: row.resolved_at ?? null,
    };
}

const SEVERITY_RANK: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};

export async function createAlertRecord(input: CreateAlertInput): Promise<AlertRecord | null> {
    const isOfflineType = input.type === 'Offline' || input.type === 'offline';

    // 1. Channel-level Active Deduplication:
    // If an unresolved alert already exists for this (robot_id, type), reuse it and upgrade severity if elevated.
    const dedupCheck = await pool.query(
        `SELECT id, severity, message, status, created_at
         FROM alerts
         WHERE robot_id = $1
           AND type = $2
           AND status NOT IN ('resolved')
         ORDER BY created_at DESC
         LIMIT 1;`,
        [input.robot_id, input.type]
    );

    if (dedupCheck.rows.length > 0) {
        const existing = dedupCheck.rows[0];
        const newRank = SEVERITY_RANK[input.severity] ?? 1;
        const existingRank = SEVERITY_RANK[existing.severity] ?? 1;

        // Upgrade severity and message in place if incoming event is more critical
        if (newRank > existingRank) {
            await pool.query(
                `UPDATE alerts
                 SET severity = $1, message = $2, updated_at = NOW()
                 WHERE id = $3;`,
                [input.severity, input.message, existing.id]
            );
            console.log(
                `[AlertService] Upgraded active alert for robot ${input.robot_id} ` +
                `type=${input.type}: ${existing.severity} -> ${input.severity}`
            );
        } else {
            // Keep message fresh and update timestamp without duplicate row creation
            await pool.query(
                `UPDATE alerts
                 SET message = $1, updated_at = NOW()
                 WHERE id = $2;`,
                [input.message, existing.id]
            );
        }

        return await getAlertById(existing.id);
    }

    // 2. Cooldown against recently resolved alert (prevent spam re-creating an alert the operator just resolved within 5 min)
    if (!isOfflineType && input.severity !== 'critical') {
        const cooldownCheck = await pool.query(
            `SELECT id FROM alerts
             WHERE robot_id = $1
               AND type = $2
               AND status = 'resolved'
               AND updated_at >= NOW() - INTERVAL '5 minutes'
             LIMIT 1;`,
            [input.robot_id, input.type]
        );
        if (cooldownCheck.rows.length > 0) {
            return null;
        }
    }

    // 3. Handled Conditions Suppression (post-maintenance grace period)
    if (!isOfflineType && (input.severity === 'critical' || input.severity === 'high')) {
        const handledCheck = await pool.query(
            `SELECT id FROM handled_conditions
             WHERE robot_id = $1
               AND suppression_expires_at > NOW()
             LIMIT 1;`,
            [input.robot_id]
        );
        if (handledCheck.rows.length > 0) {
            console.log(
                `[AlertService] Suppressing new ${input.severity} alert for robot ${input.robot_id} ` +
                `— robot has an active handled condition (maintenance recently completed).`
            );
            return null;
        }
    }

    const query = `
        INSERT INTO alerts (robot_id, type, severity, message, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, COALESCE($5, 'new'), NOW(), NOW())
        RETURNING *;
    `;
    const result = await pool.query(query, [
        input.robot_id,
        input.type,
        input.severity,
        input.message,
        input.status || 'new',
    ]);
    const created = result.rows[0];

    if (created?.robot_id) {
        await syncRobotStatus(created.robot_id).catch((err) => {
            console.warn(`[AlertService] Robot status sync failed for robot ${created.robot_id}:`, err);
        });
    }

    console.log(`[AlertService] Created new active alert: robot=${input.robot_id} type=${input.type} severity=${input.severity}`);
    return created;
}

export async function autoResolveChannelAlert(robotId: string, type: string): Promise<void> {
    const existing = await pool.query(
        `SELECT id FROM alerts
         WHERE robot_id = $1
           AND type = $2
           AND status NOT IN ('resolved');`,
        [robotId, type]
    );
    if (existing.rows.length > 0) {
        await pool.query(
            `UPDATE alerts
             SET status = 'resolved', updated_at = NOW()
             WHERE robot_id = $1
               AND type = $2
               AND status NOT IN ('resolved');`,
            [robotId, type]
        );
        console.log(`[AlertService] Auto-resolved cleared ${type} alert for robot ${robotId}`);
        await syncRobotStatus(robotId).catch((err) => {
            console.warn(`[AlertService] Robot status sync failed after auto-resolve for robot ${robotId}:`, err);
        });
        await invalidateRobotPredictionCache(robotId).catch((err) => {
            console.warn(`[AlertService] Prediction cache invalidation failed for robot ${robotId}:`, err);
        });
    }
}

/**
 * Authoritatively processes live sensor telemetry readings against physical threshold rules.
 * Generates or upgrades unresolved alert records for threshold infractions with automatic deduplication,
 * and automatically resolves open channel alerts when sensor metrics normalize.
 */
export async function processTelemetryAlerts(
    robotId: string,
    robotName: string,
    vals: {
        temperature_c: number;
        vibration_mm_s: number;
        motor_current_a: number;
        pressure_bar: number;
    }
): Promise<AlertRecord[]> {
    const createdOrUpdated: AlertRecord[] = [];

    // 1. Multi-Sensor Anomaly Check
    if (vals.vibration_mm_s >= 4.5 && vals.temperature_c >= 75.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Multi-Sensor",
            severity: "critical",
            message: `Correlated critical mechanical vibration (${vals.vibration_mm_s.toFixed(2)} mm/s) and thermal stress (${vals.temperature_c.toFixed(1)} °C) detected in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.vibration_mm_s >= 3.5 && vals.temperature_c >= 68.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Multi-Sensor",
            severity: "high",
            message: `Correlated elevated vibration (${vals.vibration_mm_s.toFixed(2)} mm/s) and thermal rise (${vals.temperature_c.toFixed(1)} °C) in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else {
        await autoResolveChannelAlert(robotId, "Multi-Sensor");
    }

    // 2. Vibration Checks (ISO 10816 Mechanical Standard)
    if (vals.vibration_mm_s >= 6.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Vibration",
            severity: "critical",
            message: `Critical vibration level (${vals.vibration_mm_s.toFixed(2)} mm/s) exceeding kinematic safety limit in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.vibration_mm_s >= 4.5) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Vibration",
            severity: "high",
            message: `Elevated vibration amplitude (${vals.vibration_mm_s.toFixed(2)} mm/s) exceeding normal baseline in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.vibration_mm_s >= 3.2) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Vibration",
            severity: "medium",
            message: `Moderate vibration fluctuation (${vals.vibration_mm_s.toFixed(2)} mm/s) above standard threshold in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else {
        await autoResolveChannelAlert(robotId, "Vibration");
    }

    // 3. Temperature Checks
    if (vals.temperature_c >= 85.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Temperature",
            severity: "critical",
            message: `Critical motor temperature (${vals.temperature_c.toFixed(1)} °C) exceeding thermal safety limit in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.temperature_c >= 75.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Temperature",
            severity: "high",
            message: `Elevated motor temperature (${vals.temperature_c.toFixed(1)} °C) above recommended threshold in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.temperature_c >= 68.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Temperature",
            severity: "medium",
            message: `Moderate temperature rise (${vals.temperature_c.toFixed(1)} °C) above baseline in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else {
        await autoResolveChannelAlert(robotId, "Temperature");
    }

    // 4. Motor Current Checks
    if (vals.motor_current_a >= 25.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Motor Current",
            severity: "critical",
            message: `Critical motor current spike (${vals.motor_current_a.toFixed(1)} A) under heavy operating load in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.motor_current_a >= 20.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Motor Current",
            severity: "high",
            message: `Elevated motor current draw (${vals.motor_current_a.toFixed(1)} A) exceeding operating bounds in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.motor_current_a >= 16.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Motor Current",
            severity: "medium",
            message: `Moderate motor current draw (${vals.motor_current_a.toFixed(1)} A) above nominal level in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else {
        await autoResolveChannelAlert(robotId, "Motor Current");
    }

    // 5. Pressure Checks
    if (vals.pressure_bar <= 2.5 || vals.pressure_bar >= 8.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Pressure",
            severity: "critical",
            message: `Critical pneumatic pressure violation (${vals.pressure_bar.toFixed(2)} bar) outside safe limits in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.pressure_bar < 4.0 || vals.pressure_bar > 7.0) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Pressure",
            severity: "high",
            message: `Abnormal pneumatic pressure (${vals.pressure_bar.toFixed(2)} bar) exceeding operating tolerance in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else if (vals.pressure_bar < 4.2 || vals.pressure_bar > 6.2) {
        const alert = await createAlertRecord({
            robot_id: robotId,
            type: "Pressure",
            severity: "medium",
            message: `Moderate pneumatic pressure variance (${vals.pressure_bar.toFixed(2)} bar) outside nominal bounds in ${robotName}.`,
        });
        if (alert) createdOrUpdated.push(alert);
    } else {
        await autoResolveChannelAlert(robotId, "Pressure");
    }

    return createdOrUpdated;
}

export async function updateAlertStatus(
    id: string,
    patch: Partial<{ status: string; severity: string; message: string }>
): Promise<AlertRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (patch.status) {
        fields.push(`status = $${index}`);
        values.push(patch.status);
        index += 1;
    }
    if (patch.severity) {
        fields.push(`severity = $${index}`);
        values.push(patch.severity);
        index += 1;
    }
    if (patch.message) {
        fields.push(`message = $${index}`);
        values.push(patch.message);
        index += 1;
    }

    if (fields.length === 0) {
        return getAlertById(id);
    }

    values.push(id);
    const query = `
        UPDATE alerts
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${index}
        RETURNING *;
    `;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return null;
    const updated = result.rows[0];

    if (updated?.robot_id) {
        await syncRobotStatus(updated.robot_id).catch((err) => {
            console.warn(`[AlertService] Robot status sync failed for robot ${updated.robot_id}:`, err);
        });
    }

    return updated;
}

export async function acknowledgeAlert(id: string): Promise<AlertRecord | null> {
    const query = `
        UPDATE alerts
        SET status = 'acknowledged', updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    const acked = result.rows[0];

    if (acked?.robot_id) {
        await syncRobotStatus(acked.robot_id).catch((err) => {
            console.warn(`[AlertService] Robot status sync failed for robot ${acked.robot_id}:`, err);
        });
    }

    return acked;
}

export async function resolveAlert(id: string): Promise<AlertRecord | null> {
    // Fetch the robot_id so we can sync the robot status and invalidate prediction cache
    const fetchQuery = `SELECT robot_id FROM alerts WHERE id = $1;`;
    const fetchResult = await pool.query(fetchQuery, [id]);
    const robotId: string | undefined = fetchResult.rows[0]?.robot_id;

    const query = `
        UPDATE alerts
        SET status = 'resolved', updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;

    if (robotId) {
        // Authoritatively recalculate and synchronize the robot's status in PostgreSQL
        await syncRobotStatus(robotId).catch((err) => {
            console.warn(`[AlertService] Robot status sync failed for robot ${robotId}:`, err);
        });

        // Invalidate the Redis prediction cache for this robot so the next prediction
        // evaluation reflects the resolved alert immediately.
        invalidateRobotPredictionCache(robotId).catch((err) => {
            console.warn(`[AlertService] Cache invalidation failed for robot ${robotId}:`, err);
        });
    }

    return getAlertById(id);
}
