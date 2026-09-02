import { pool } from "../db/postgres.js";
import { redisClient } from "../config/redis.js";

export async function getSensorReadingsByRobot(robotId: string) {
    const cacheKey = `sensors:${robotId}`;
    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
    } catch {
        // Fallback to PostgreSQL
    }

    const result = await pool.query(
        `
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
      ORDER BY recorded_at DESC
      LIMIT 100;
    `,
        [robotId]
    );

    const rows = result.rows;
    try {
        if (redisClient.isOpen && rows.length > 0) {
            await redisClient.set(cacheKey, JSON.stringify(rows), { EX: 10 });
        }
    } catch {
        // Ignore cache errors
    }

    return rows;
}