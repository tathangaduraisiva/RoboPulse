import { pool } from "../db/postgres.js";

export async function getSensorReadingsByRobot(robotId: string) {
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

    return result.rows;
}