import { pool } from "../db/postgres.js";
export async function getAllAlerts() {
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
export async function getAlertById(id) {
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
    if (result.rows.length === 0)
        return null;
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
export async function createAlertRecord(input) {
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
export async function updateAlertStatus(id, patch) {
    const fields = [];
    const values = [];
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
    if (result.rows.length === 0)
        return null;
    return result.rows[0];
}
export async function acknowledgeAlert(id) {
    const query = `
        UPDATE alerts
        SET status = 'acknowledged', updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0)
        return null;
    return result.rows[0];
}
export async function resolveAlert(id) {
    const query = `
        UPDATE alerts
        SET status = 'resolved', updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0)
        return null;
    return result.rows[0];
}
