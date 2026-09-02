import * as fs from 'fs';
import * as path from 'path';
import { pool, closePool } from './db';

async function seedDatabase(): Promise<void> {
  console.log('====================================================');
  console.log('  RoboPulse Database Seeding Runner');
  console.log('====================================================');

  const seedFilePath = path.resolve(__dirname, '../seeds/001_seed_data.sql');
  if (!fs.existsSync(seedFilePath)) {
    console.error(`[Error] Seed SQL file not found: ${seedFilePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(seedFilePath, 'utf-8');
  const client = await pool.connect();

  try {
    console.log('[Seeding] Loading and executing 001_seed_data.sql...');
    const start = Date.now();
    await client.query(sql);
    const duration = Date.now() - start;
    console.log(`[Success] Seed data successfully committed in ${duration}ms.`);
  } catch (err: any) {
    console.error('[Failure] Error executing seed data:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await seedDatabase();
    await closePool();
    process.exit(0);
  } catch (error: any) {
    console.error('[Fatal Error] Seeding failed:', error.message);
    await closePool();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
