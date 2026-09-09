import { pool } from "../db/postgres.js";
import { redisClient } from "../config/redis.js";
export async function getSensorReadingsByRobot(robotId) {
    const cacheKey = `sensors:${robotId}`;
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
    const result = await pool.query(`
      SELECT
        id,
        robot_id,
        temperature_c,
        vibration_mm_s,
        motor_current_a,
        pressure_bar,
        recorded_at
      FROM sensor_readings
      WHERE robot_id = $1
        AND recorded_at >= NOW() - INTERVAL '1 hour'
      ORDER BY recorded_at DESC
      LIMIT 1800;
    `, [robotId]);
    const rows = result.rows.map((r) => ({
        ...r,
        temperature_c: Number(r.temperature_c) || 0,
        vibration_mm_s: Number(r.vibration_mm_s) || 0,
        motor_current_a: Number(r.motor_current_a) || 0,
        pressure_bar: Number(r.pressure_bar) || 0,
    }));
    try {
        if (redisClient.isOpen && rows.length > 0) {
            // TTL of 1 s — short enough that each 2-second frontend poll
            // always fetches a fresh result containing the newest inserted row.
            await redisClient.set(cacheKey, JSON.stringify(rows), { EX: 1 });
        }
    }
    catch {
        // Ignore cache errors
    }
    return rows;
}
