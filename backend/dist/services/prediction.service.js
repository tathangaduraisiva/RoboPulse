import { pool } from "../db/postgres.js";
export async function getAllPredictions() {
    const query = `
        SELECT DISTINCT ON (ra.robot_id)
            ra.id,
            ra.robot_id,
            r.name AS robot_name,
            r.serial_number AS robot_serial,
            r.model AS robot_model,
            r.status AS robot_status,
            COALESCE(pl.name, 'Unassigned') AS line_name,
            ra.health_score,
            ra.risk_score,
            ra.risk_level,
            ra.temperature_score,
            ra.vibration_score,
            ra.runtime_score,
            ra.error_score,
            ra.maintenance_score,
            ra.primary_reason,
            ra.recommendation,
            ra.calculated_at
        FROM risk_assessments ra
        JOIN robots r ON ra.robot_id = r.id
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        ORDER BY ra.robot_id, ra.calculated_at DESC;
    `;
    const result = await pool.query(query);
    // Sort by risk_score DESC so critical/high risk units appear first
    return result.rows.sort((a, b) => Number(b.risk_score) - Number(a.risk_score));
}
