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

export async function createAlertRecord(input: CreateAlertInput): Promise<AlertRecord | null> {
    // Deduplication: do not create a new alert if an equivalent unresolved alert
    // already exists for this robot/type/severity.
    const isOfflineType = input.type === 'Offline' || input.type === 'offline';
    const dedupCheck = await pool.query(
        isOfflineType
            ? `SELECT id FROM alerts
               WHERE robot_id = $1
                 AND type = $2
                 AND status NOT IN ('resolved')
               LIMIT 1;`
            : `SELECT id FROM alerts
               WHERE robot_id = $1
                 AND type = $2
                 AND severity = $3
                 AND status NOT IN ('resolved')
                 AND created_at >= NOW() - INTERVAL '24 hours'
               LIMIT 1;`,
        isOfflineType
            ? [input.robot_id, input.type]
            : [input.robot_id, input.type, input.severity]
    );

    if (dedupCheck.rows.length > 0) {
        console.log(
            `[AlertService] Skipping duplicate alert creation for robot ${input.robot_id} ` +
            `type=${input.type} severity=${input.severity} (existing alert: ${dedupCheck.rows[0].id})`
        );
        const existing = await getAlertById(dedupCheck.rows[0].id);
        return existing;
    }

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
        INSERT INTO alerts (robot_id, type, severity, message, status)
        VALUES ($1, $2, $3, $4, COALESCE($5, 'new'))
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

    return created;
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
