import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
});

export async function checkDatabaseConnection(): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query("SELECT 1");
        console.log("✓ PostgreSQL connection established");
    } finally {
        client.release();
    }
}

export async function verifyDatabaseSchema(): Promise<void> {
    const client = await pool.connect();

    try {
        // Check if users table exists (indicates migrations have been run)
        const result = await client.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );`
        );

        const usersTableExists = result.rows[0].exists;
        if (!usersTableExists) {
            console.error("\n❌ SCHEMA ERROR: 'users' table not found in database.");
            console.error("\n   Database migrations have not been applied.");
            console.error("   Please run the following commands:\n");
            console.error("   cd /path/to/RoboPulse");
            console.error("   npm run db:migrate");
            console.error("   npm run db:verify\n");
            throw new Error("Database schema not initialized - migrations required");
        }

        // Check if admin user exists
        const adminCheck = await client.query(
            `SELECT COUNT(*) as count FROM users WHERE username = 'admin';`
        );

        if (adminCheck.rows[0].count === 0) {
            console.warn("⚠️  WARNING: Admin user not found in database.");
            console.warn("   Run: npm run db:migrate\n");
        }

        // Ensure required unresolved alerts exist in PostgreSQL
        await ensureRequiredAlerts(client);

        console.log("✓ Database schema verified");
    } finally {
        client.release();
    }
}

export async function ensureRequiredAlerts(client: pg.PoolClient): Promise<void> {
    const alertsTableCheck = await client.query(
        `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'alerts'
        );`
    );

    if (!alertsTableCheck.rows[0].exists) {
        return;
    }

    // Ensure Alert 1: ROBOT-003 Medium Temperature Unresolved Alert
    await client.query(`
        INSERT INTO alerts (id, robot_id, type, severity, message, status, created_at, updated_at)
        SELECT 
            '50000000-0000-0000-0000-000000000001'::uuid,
            r.id,
            'Temperature',
            'medium',
            'Motor temperature above recommended operating range',
            'new',
            NOW() - INTERVAL '2 hours',
            NOW() - INTERVAL '2 hours'
        FROM robots r 
        WHERE r.name = 'ROBOT-003' OR r.id = '20000000-0000-0000-0000-000000000003'
        ON CONFLICT (id) DO NOTHING;
    `);

    // Ensure Alert 2: ROBOT-006 High Vibration Unresolved Alert
    await client.query(`
        INSERT INTO alerts (id, robot_id, type, severity, message, status, created_at, updated_at)
        SELECT 
            '50000000-0000-0000-0000-000000000002'::uuid,
            r.id,
            'Vibration',
            'high',
            'Elevated vibration detected in recent sensor readings',
            'new',
            NOW() - INTERVAL '4 hours',
            NOW() - INTERVAL '4 hours'
        FROM robots r 
        WHERE r.name = 'ROBOT-006' OR r.id = '20000000-0000-0000-0000-000000000006'
        ON CONFLICT (id) DO NOTHING;
    `);

    // Ensure Alert 3: ROBOT-002 Low Motor Current Unresolved Alert
    await client.query(`
        INSERT INTO alerts (id, robot_id, type, severity, message, status, created_at, updated_at)
        SELECT 
            '50000000-0000-0000-0000-000000000003'::uuid,
            r.id,
            'Motor Current',
            'low',
            'Motor current showing sustained variation from normal operating levels',
            'new',
            NOW() - INTERVAL '6 hours',
            NOW() - INTERVAL '6 hours'
        FROM robots r 
        WHERE r.name = 'ROBOT-002' OR r.id = '20000000-0000-0000-0000-000000000002'
        ON CONFLICT (id) DO NOTHING;
    `);
}