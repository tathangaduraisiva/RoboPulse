import { pool } from "../db/postgres.js";
export async function getAllMaintenance() {
    const query = `
        SELECT 
            m.id,
            m.robot_id,
            r.name AS robot_name,
            r.serial_number AS robot_serial,
            r.model AS robot_model,
            COALESCE(pl.name, 'Unassigned') AS line_name,
            m.component_id,
            c.name AS component_name,
            m.maintenance_type,
            m.description,
            m.technician,
            m.cost,
            m.performed_at,
            m.next_due_at,
            m.created_at,
            CASE
                WHEN m.next_due_at IS NOT NULL AND m.next_due_at < NOW() THEN 'overdue'
                WHEN m.next_due_at IS NOT NULL AND m.next_due_at >= NOW() THEN 'upcoming'
                ELSE 'completed'
            END AS status
        FROM maintenance_records m
        JOIN robots r ON m.robot_id = r.id
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        LEFT JOIN components c ON m.component_id = c.id
        ORDER BY 
            COALESCE(m.next_due_at, m.performed_at) ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
}
export async function createMaintenance(dto) {
    const query = `
        INSERT INTO maintenance_records (
            robot_id,
            component_id,
            maintenance_type,
            description,
            technician,
            cost,
            performed_at,
            next_due_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, NOW(), $7
        )
        RETURNING *;
    `;
    const result = await pool.query(query, [
        dto.robot_id,
        dto.component_id || null,
        dto.maintenance_type,
        dto.description,
        dto.technician || "Fleet Tech Team",
        dto.cost || 0,
        dto.next_due_at || null,
    ]);
    return result.rows[0];
}
export async function markMaintenanceComplete(id) {
    const query = `
        UPDATE maintenance_records
        SET performed_at = NOW(), next_due_at = NULL
        WHERE id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0)
        return null;
    return result.rows[0];
}
