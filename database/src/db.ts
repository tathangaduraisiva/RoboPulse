import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from project root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'robopulse',
  user: process.env.DB_USER || 'robopulse_user',
  password: process.env.DB_PASSWORD || 'robopulse_password',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
};

export const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('[RoboPulse DB] Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Execute a parameterized query against the PostgreSQL pool.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log(`[SQL Query] (${duration}ms) ${text.substring(0, 100)}...`);
    }
    return res;
  } catch (error: any) {
    console.error(`[SQL Error] Failed executing query: ${text.substring(0, 120)}...`);
    console.error(`[SQL Error Details] ${error.message}`);
    throw error;
  }
}

/**
 * Gracefully close the database pool.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
