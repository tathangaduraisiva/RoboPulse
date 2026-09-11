import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: Number(process.env.DATABASE_PORT) || 5433,
    database: process.env.DATABASE_NAME || "robopulse",
    user: process.env.DATABASE_USER || "robopulse_user",
    password: process.env.DATABASE_PASSWORD || "robopulse_password",
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
    console.error("[PostgreSQL Pool] Unexpected error on idle client:", err.message);
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

        // Ensure technicians and assignments tables exist (from migration 002)
        await client.query(`
            CREATE TABLE IF NOT EXISTS technicians (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(120) NOT NULL,
                employee_code VARCHAR(40) NOT NULL UNIQUE,
                specialization VARCHAR(80) NOT NULL DEFAULT 'general',
                phone VARCHAR(40),
                email VARCHAR(120),
                status VARCHAR(30) NOT NULL DEFAULT 'available',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT technicians_status_check
                    CHECK (status IN ('available', 'assigned', 'offline'))
            );
            CREATE INDEX IF NOT EXISTS idx_technicians_status ON technicians(status);
            CREATE INDEX IF NOT EXISTS idx_technicians_employee_code ON technicians(employee_code);

            CREATE TABLE IF NOT EXISTS technician_robot_assignments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                technician_id UUID NOT NULL
                    REFERENCES technicians(id)
                    ON DELETE CASCADE,
                robot_id UUID NOT NULL
                    REFERENCES robots(id)
                    ON DELETE CASCADE,
                assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                unassigned_at TIMESTAMPTZ,
                CONSTRAINT unique_active_assignment
                    UNIQUE (technician_id, robot_id)
            );
            CREATE INDEX IF NOT EXISTS idx_tra_technician ON technician_robot_assignments(technician_id);
            CREATE INDEX IF NOT EXISTS idx_tra_robot ON technician_robot_assignments(robot_id);
        `);

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
    // ON CONFLICT (id) DO NOTHING — safe to call on every startup; never re-creates if already exists.
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

    // Ensure Alert 3: Offline alert for any robot currently in 'offline' status.
    //
    // This is GENERIC — it does not hardcode any robot name or ID.
    // For each offline robot, we derive a stable alert UUID by replacing the first
    // UUID segment prefix (2000...) with 5000... so it is deterministic and collision-free.
    // The INSERT uses ON CONFLICT (id) DO NOTHING so repeated startups are idempotent.
    //
    // We also skip creation when an offline alert already exists for that robot.
    await client.query(`
        INSERT INTO alerts (id, robot_id, type, severity, message, status, created_at, updated_at)
        SELECT
            -- Derive a stable UUID from the robot's own UUID: swap leading '2' for '5'
            -- e.g. 20000000-0000-0000-0000-000000000008 → 50000000-0000-0000-0000-000000000008
            (REPLACE(r.id::text, '20000000', '50000000'))::uuid,
            r.id,
            'Offline',
            'critical',
            r.name || ' is offline and unresponsive. Immediate inspection required.',
            'new',
            NOW(),
            NOW()
        FROM robots r
        WHERE r.status = 'offline'
          AND NOT EXISTS (
              SELECT 1 FROM alerts a
              WHERE a.robot_id = r.id
                AND a.type = 'Offline'
          )
        ON CONFLICT (id) DO NOTHING;
    `);

    console.log('[DB] ensureRequiredAlerts: offline robot alert check complete');
}