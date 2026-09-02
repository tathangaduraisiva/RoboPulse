import { pool } from "../db/postgres.js";

export async function getProductionLines() {
    const result = await pool.query(`
        SELECT
            pl.id,
            pl.name,
            pl.code,
            pl.description,
            pl.location,
            pl.created_at,
            COUNT(r.id)::int AS robot_count
        FROM production_lines pl
        LEFT JOIN robots r
            ON r.line_id = pl.id
        GROUP BY
            pl.id,
            pl.name,
            pl.code,
            pl.description,
            pl.location,
            pl.created_at
        ORDER BY pl.name;
    `);

    return result.rows;
}