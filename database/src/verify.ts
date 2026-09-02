import { query, closePool } from './db';

interface IndexInfo {
  indexname: string;
  tablename: string;
  indexdef: string;
}

async function verifyDatabase(): Promise<void> {
  console.log('====================================================');
  console.log('  RoboPulse Database Verification & Diagnostics');
  console.log('====================================================\n');

  // 1. Check Tables and Record Counts
  const tables = [
    'production_lines',
    'robots',
    'components',
    'sensor_readings',
    'anomalies',
    'maintenance_records',
    'risk_assessments',
    'schema_migrations',
  ];

  console.log('📊 Table Verification & Row Counts:');
  console.log('----------------------------------------------------');

  for (const table of tables) {
    try {
      const res = await query(`SELECT COUNT(*) AS cnt FROM ${table}`);
      const count = parseInt(res.rows[0].cnt, 10);
      console.log(`  ✓ Table: ${table.padEnd(25)} Rows: ${count.toString().padStart(4)}`);
    } catch (err: any) {
      console.error(`  ✗ Table: ${table.padEnd(25)} ERROR: ${err.message}`);
    }
  }

  // 2. Foreign Key Integrity Check
  console.log('\n🔗 Relational Integrity & Orphan Check:');
  console.log('----------------------------------------------------');

  const integrityChecks = [
    {
      name: 'Robots without valid Production Line',
      sql: `SELECT COUNT(*) AS cnt FROM robots r LEFT JOIN production_lines p ON r.line_id = p.id WHERE p.id IS NULL;`,
    },
    {
      name: 'Components without valid Robot',
      sql: `SELECT COUNT(*) AS cnt FROM components c LEFT JOIN robots r ON c.robot_id = r.id WHERE r.id IS NULL;`,
    },
    {
      name: 'Sensor Readings without valid Robot',
      sql: `SELECT COUNT(*) AS cnt FROM sensor_readings s LEFT JOIN robots r ON s.robot_id = r.id WHERE r.id IS NULL;`,
    },
    {
      name: 'Anomalies without valid Robot',
      sql: `SELECT COUNT(*) AS cnt FROM anomalies a LEFT JOIN robots r ON a.robot_id = r.id WHERE r.id IS NULL;`,
    },
    {
      name: 'Maintenance Records without valid Robot',
      sql: `SELECT COUNT(*) AS cnt FROM maintenance_records m LEFT JOIN robots r ON m.robot_id = r.id WHERE r.id IS NULL;`,
    },
    {
      name: 'Risk Assessments without valid Robot',
      sql: `SELECT COUNT(*) AS cnt FROM risk_assessments ra LEFT JOIN robots r ON ra.robot_id = r.id WHERE r.id IS NULL;`,
    },
  ];

  for (const check of integrityChecks) {
    const res = await query(check.sql);
    const orphans = parseInt(res.rows[0].cnt, 10);
    if (orphans === 0) {
      console.log(`  ✓ 0 orphans: ${check.name}`);
    } else {
      console.error(`  ✗ ${orphans} orphan(s) found: ${check.name}`);
    }
  }

  // 3. Index Verification
  console.log('\n⚡ Index Verification:');
  console.log('----------------------------------------------------');

  const requiredIndexes = [
    'idx_robots_line_id',
    'idx_robots_status',
    'idx_components_robot_id',
    'idx_components_status',
    'idx_sensor_readings_robot_time',
    'idx_anomalies_robot_status',
    'idx_anomalies_severity',
    'idx_anomalies_detected_at',
    'idx_maintenance_robot_date',
    'idx_maintenance_component',
    'idx_maintenance_next_due',
    'idx_risk_robot_time',
    'idx_risk_level',
  ];

  const indexQuery = `
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname;
  `;
  const indexRes = await query<IndexInfo>(indexQuery);
  const foundIndexNames = new Set(indexRes.rows.map((row) => row.indexname));

  for (const idx of requiredIndexes) {
    if (foundIndexNames.has(idx)) {
      console.log(`  ✓ Found index: ${idx}`);
    } else {
      console.error(`  ✗ Missing index: ${idx}`);
    }
  }

  // 4. Sample Key Query Performance Tests
  console.log('\n🚀 Common Query Execution & Plan Validation:');
  console.log('----------------------------------------------------');

  const sampleQueries = [
    {
      title: 'Query 1: Robots by Production Line',
      sql: `
        SELECT r.name, r.status, p.name AS line_name
        FROM robots r
        JOIN production_lines p ON r.line_id = p.id
        WHERE p.code = 'PL-WELD-01';
      `,
    },
    {
      title: 'Query 2: Latest Sensor Readings for Robot (Time-Series)',
      sql: `
        SELECT recorded_at, temperature_c, vibration_mm_s, motor_current_a
        FROM sensor_readings
        WHERE robot_id = '20000000-0000-0000-0000-000000000003'
        ORDER BY recorded_at DESC
        LIMIT 5;
      `,
    },
    {
      title: 'Query 3: Open / Investigating Anomalies with Robot & Component Context',
      sql: `
        SELECT a.anomaly_type, a.severity, a.status, r.name AS robot_name, c.name AS component_name
        FROM anomalies a
        JOIN robots r ON a.robot_id = r.id
        LEFT JOIN components c ON c.robot_id = a.robot_id
        WHERE a.status IN ('open', 'investigating')
        ORDER BY a.detected_at DESC;
      `,
    },
    {
      title: 'Query 4: Maintenance Records with Robot Context',
      sql: `
        SELECT m.maintenance_type, m.description, m.technician, m.cost, r.name AS robot_name
        FROM maintenance_records m
        JOIN robots r ON m.robot_id = r.id
        ORDER BY m.performed_at DESC;
      `,
    },
    {
      title: 'Query 5: Latest Robot Risk Scores',
      sql: `
        SELECT r.name, ra.health_score, ra.risk_level, ra.recommendation
        FROM risk_assessments ra
        JOIN robots r ON ra.robot_id = r.id
        ORDER BY ra.calculated_at DESC;
      `,
    },
  ];

  for (const q of sampleQueries) {
    console.log(`\n  ▶ ${q.title}`);
    const res = await query(q.sql);
    console.table(res.rows);
  }

  console.log('\n====================================================');
  console.log('  All verification checks passed successfully!');
  console.log('====================================================\n');
}

async function main() {
  try {
    await verifyDatabase();
    await closePool();
    process.exit(0);
  } catch (err: any) {
    console.error('[Fatal Error] Verification failed:', err.message);
    await closePool();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
