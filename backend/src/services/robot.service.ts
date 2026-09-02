import { pool } from "../db/postgres.js";

export async function getAllRobots() {
    const result = await pool.query(`
    SELECT
      id,
      line_id,
      name,
      serial_number,
      model,
      manufacturer,
      status,
      installation_date,
      total_runtime_hours,
      created_at
    FROM robots
    ORDER BY name;
  `);

    return result.rows;
}