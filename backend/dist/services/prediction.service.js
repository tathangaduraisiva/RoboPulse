import { pool } from "../db/postgres.js";
import { redisClient } from "../config/redis.js";
export async function getAllPredictions() {
    const cacheKey = "predictions:all";
    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
    }
    catch {
        // Fallback to PostgreSQL
    }
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
    const parsedRows = result.rows.map((r) => ({
        ...r,
        health_score: Number(r.health_score) || 0,
        risk_score: Number(r.risk_score) || 0,
        temperature_score: Number(r.temperature_score) || 0,
        vibration_score: Number(r.vibration_score) || 0,
        runtime_score: Number(r.runtime_score) || 0,
        error_score: Number(r.error_score) || 0,
        maintenance_score: Number(r.maintenance_score) || 0,
    }));
    // Sort by risk_score DESC so critical/high risk units appear first
    const sorted = parsedRows.sort((a, b) => Number(b.risk_score) - Number(a.risk_score));
    try {
        if (redisClient.isOpen && sorted.length > 0) {
            await redisClient.set(cacheKey, JSON.stringify(sorted), { EX: 15 });
        }
    }
    catch {
        // Ignore cache errors
    }
    return sorted;
}
