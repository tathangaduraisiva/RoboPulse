-- ============================================================================
-- RoboPulse - Robot Health & Predictive Maintenance Platform
-- Migration Rollback: 001_initial_schema.down.sql
-- Description: Cleanly drops all tables, triggers, and helper functions in reverse dependency order.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_maintenance_records_updated_at ON maintenance_records;
DROP TRIGGER IF EXISTS trg_anomalies_updated_at ON anomalies;
DROP TRIGGER IF EXISTS trg_components_updated_at ON components;
DROP TRIGGER IF EXISTS trg_robots_updated_at ON robots;
DROP TRIGGER IF EXISTS trg_production_lines_updated_at ON production_lines;

DROP TABLE IF EXISTS risk_assessments CASCADE;
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS anomalies CASCADE;
DROP TABLE IF EXISTS sensor_readings CASCADE;
DROP TABLE IF EXISTS components CASCADE;
DROP TABLE IF EXISTS robots CASCADE;
DROP TABLE IF EXISTS production_lines CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column();
