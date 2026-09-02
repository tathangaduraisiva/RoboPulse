import * as fs from 'fs';
import * as path from 'path';
import { pool, query, closePool } from './db';

interface MigrationRecord {
  version: string;
  applied_at: Date;
}

const migrationRequirements: Record<string, { tables?: string[]; enums?: string[] }> = {
  '001_initial_schema.sql': {
    tables: [
      'production_lines',
      'robots',
      'components',
      'sensor_readings',
      'anomalies',
      'maintenance_records',
      'risk_assessments',
    ],
    enums: [
      'robot_status',
      'component_status',
      'anomaly_severity',
      'anomaly_status',
      'maintenance_type',
      'risk_level',
    ],
  },
  '002_users_technicians.sql': {
    tables: ['users', 'technicians', 'technician_robot_assignments'],
  },
  '003_alerts_and_auth_seed.sql': {
    tables: ['alerts'],
  },
};

async function ensureMigrationTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query<MigrationRecord>('SELECT version FROM schema_migrations ORDER BY id ASC;');
  return new Set(result.rows.map((row) => row.version));
}

async function tableExists(tableName: string): Promise<boolean> {
  const res = await query(
    `SELECT to_regclass($1) AS table_name;`,
    [`public.${tableName}`],
  );
  return !!res.rows[0]?.table_name;
}

async function enumExists(enumName: string): Promise<boolean> {
  const res = await query(
    `SELECT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = $1 AND t.typtype = 'e'
    ) AS exists;`,
    [enumName],
  );
  return res.rows[0]?.exists === true;
}

async function recordMigration(file: string): Promise<void> {
  await query(
    `INSERT INTO schema_migrations (version) VALUES ($1)
     ON CONFLICT (version) DO NOTHING;`,
    [file],
  );
}

async function migrationAlreadySatisfied(file: string): Promise<boolean> {
  const requirements = migrationRequirements[file];
  if (!requirements) {
    return false;
  }

  const tableChecks = (requirements.tables ?? []).map((tableName) => tableExists(tableName));
  const enumChecks = (requirements.enums ?? []).map((enumName) => enumExists(enumName));
  const results = await Promise.all([...tableChecks, ...enumChecks]);
  return results.every(Boolean);
}

async function runMigrations(): Promise<void> {
  console.log('====================================================');
  console.log('  RoboPulse Database Migration Runner');
  console.log('====================================================');

  const migrationsDir = path.resolve(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`[Error] Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  await ensureMigrationTable();
  const appliedMigrations = await getAppliedMigrations();

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('[Info] No migration files found to execute.');
    return;
  }

  let pendingCount = 0;

  for (const file of migrationFiles) {
    if (appliedMigrations.has(file)) {
      console.log(`[Skipped] ${file} (already applied in schema_migrations)`);
      continue;
    }

    if (await migrationAlreadySatisfied(file)) {
      await recordMigration(file);
      console.log(`[Recovered] ${file} already exists in the database; recorded in schema_migrations.`);
      continue;
    }

    pendingCount++;
    console.log(`[Applying] ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      try {
        await client.query(sql);
      } catch (error: any) {
        const duplicateObject =
          error && (
            error.code === '42710' ||
            error.code === '42P07' ||
            String(error.message).includes('already exists') ||
            String(error.message).includes('duplicate key')
          );

        if (duplicateObject && (await migrationAlreadySatisfied(file))) {
          await client.query('ROLLBACK');
          await recordMigration(file);
          console.log(`[Recovered] ${file} already satisfied after duplicate-object race; recorded in schema_migrations.`);
          continue;
        }

        throw error;
      }

      await recordMigration(file);
      await client.query('COMMIT');
      console.log(`[Success] Applied migration: ${file}`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`[Failure] Error applying migration ${file}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  if (pendingCount === 0) {
    console.log('[Status] Database is already up-to-date. No pending migrations.');
  } else {
    console.log(`[Status] Successfully executed ${pendingCount} migration(s).`);
  }
}

async function main() {
  try {
    await runMigrations();
    await closePool();
    process.exit(0);
  } catch (error: any) {
    console.error('[Fatal Error] Migration failed:', error.message);
    await closePool();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
