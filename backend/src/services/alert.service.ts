import { pool } from "../db/postgres.js";

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
            a.updated_at AS resolved_at
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
            a.updated_at AS resolved_at
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

export async function createAlertRecord(input: CreateAlertInput): Promise<AlertRecord> {
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
    return result.rows[0];
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
    return result.rows[0];
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
    return result.rows[0];
}

export async function resolveAlert(id: string): Promise<AlertRecord | null> {
    const query = `
        UPDATE alerts
        SET status = 'resolved', updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
}
