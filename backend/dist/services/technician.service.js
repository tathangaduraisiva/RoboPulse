import { pool } from "../db/postgres.js";
export async function getAllTechnicians() {
    const query = `
        SELECT t.*
        FROM technicians t
        ORDER BY t.name ASC;
    `;
    const result = await pool.query(query);
    const technicians = (result.rows || []);
    if (technicians.length === 0) {
        return [];
    }
    await Promise.all(technicians.map(async (tech) => {
        const assignments = await pool.query(`
                SELECT
                    tra.id,
                    r.id AS robot_id,
                    r.name AS robot_name,
                    r.serial_number AS robot_code,
                    r.model,
                    r.status,
                    COALESCE(pl.name, 'Unassigned') AS production_line
                FROM technician_robot_assignments tra
                JOIN robots r ON tra.robot_id = r.id
                LEFT JOIN production_lines pl ON r.line_id = pl.id
                WHERE tra.technician_id = $1 AND tra.unassigned_at IS NULL
                ORDER BY r.name ASC;
                `, [tech.id]);
        tech.assigned_robots = assignments.rows || [];
    }));
    return technicians;
}
export async function getTechnicianById(id) {
    const result = await pool.query(`SELECT * FROM technicians WHERE id = $1 LIMIT 1`, [id]);
    const tech = result.rows[0];
    if (!tech) {
        return null;
    }
    const assignments = await pool.query(`
        SELECT
            r.id AS robot_id,
            r.name AS robot_name,
            r.serial_number AS robot_code,
            r.model,
            r.status,
            COALESCE(pl.name, 'Unassigned') AS production_line
        FROM technician_robot_assignments tra
        JOIN robots r ON tra.robot_id = r.id
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        WHERE tra.technician_id = $1 AND tra.unassigned_at IS NULL
        ORDER BY r.name ASC;
        `, [id]);
    tech.assigned_robots = assignments.rows;
    return tech;
}
export async function createTechnician(input) {
    const result = await pool.query(`
        INSERT INTO technicians (name, employee_code, specialization, phone, email, status)
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'available'))
        RETURNING *;
        `, [input.name, input.employee_code, input.specialization, input.phone || null, input.email || null, input.status || "available"]);
    return result.rows[0];
}
export async function updateTechnician(id, input) {
    const fields = [];
    const values = [];
    let index = 1;
    for (const [key, value] of Object.entries(input)) {
        if (value === undefined)
            continue;
        fields.push(`${key} = $${index}`);
        values.push(value);
        index += 1;
    }
    if (fields.length === 0) {
        return getTechnicianById(id);
    }
    values.push(id);
    const query = `
        UPDATE technicians
        SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${index}
        RETURNING *;
    `;
    const result = await pool.query(query, values);
    if (result.rows.length === 0)
        return null;
    return result.rows[0];
}
export async function deleteTechnician(id) {
    const result = await pool.query(`DELETE FROM technicians WHERE id = $1 RETURNING id;`, [id]);
    return result.rowCount !== null && result.rowCount > 0;
}
export async function assignRobotToTechnician(technicianId, robotId) {
    const existing = await pool.query(`SELECT id FROM technician_robot_assignments WHERE technician_id = $1 AND robot_id = $2 AND unassigned_at IS NULL LIMIT 1;`, [technicianId, robotId]);
    if (existing.rowCount && existing.rowCount > 0) {
        return existing.rows[0];
    }
    const result = await pool.query(`INSERT INTO technician_robot_assignments (technician_id, robot_id, assigned_at, unassigned_at)
         VALUES ($1, $2, NOW(), NULL)
         ON CONFLICT (technician_id, robot_id)
         DO UPDATE SET unassigned_at = NULL, assigned_at = NOW()
         RETURNING id;`, [technicianId, robotId]);
    await pool.query(`UPDATE technicians SET status = 'assigned', updated_at = NOW() WHERE id = $1;`, [technicianId]);
    return result.rows[0];
}
export async function removeRobotAssignment(technicianId, robotId) {
    const result = await pool.query(`UPDATE technician_robot_assignments
         SET unassigned_at = NOW()
         WHERE technician_id = $1 AND robot_id = $2 AND unassigned_at IS NULL
         RETURNING id;`, [technicianId, robotId]);
    const remaining = await pool.query(`SELECT COUNT(*) AS total FROM technician_robot_assignments WHERE technician_id = $1 AND unassigned_at IS NULL;`, [technicianId]);
    if (Number(remaining.rows[0].total) === 0) {
        await pool.query(`UPDATE technicians SET status = 'available', updated_at = NOW() WHERE id = $1;`, [technicianId]);
    }
    return result.rowCount !== null && result.rowCount > 0;
}
export async function getTechnicianAssignments(technicianId) {
    const result = await pool.query(`
        SELECT
            r.id AS robot_id,
            r.name AS robot_name,
            r.serial_number AS robot_code,
            r.model,
            r.status,
            COALESCE(pl.name, 'Unassigned') AS production_line
        FROM technician_robot_assignments tra
        JOIN robots r ON tra.robot_id = r.id
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        WHERE tra.technician_id = $1 AND tra.unassigned_at IS NULL
        ORDER BY r.name ASC;
        `, [technicianId]);
    return result.rows;
}
