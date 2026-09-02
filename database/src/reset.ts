import * as fs from 'fs';
import * as path from 'path';
import { pool, closePool } from './db';

async function resetDatabase(): Promise<void> {
  console.log('====================================================');
  console.log('  RoboPulse Database Reset Runner');
  console.log('====================================================');

  const downFilePath = path.resolve(__dirname, '../migrations/001_initial_schema.down.sql');
  const client = await pool.connect();

  try {
    console.log('[Reset] Dropping existing schema objects...');
    if (fs.existsSync(downFilePath)) {
      const downSql = fs.readFileSync(downFilePath, 'utf-8');
      await client.query(downSql);
    }
    await client.query('DROP TABLE IF EXISTS schema_migrations CASCADE;');
    console.log('[Success] Database cleanly reset.');
  } catch (err: any) {
    console.error('[Failure] Error resetting database:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await resetDatabase();
    await closePool();
    process.exit(0);
  } catch (error: any) {
    console.error('[Fatal Error] Reset failed:', error.message);
    await closePool();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
