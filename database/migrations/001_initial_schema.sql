-- ============================================================
-- RoboPulse
-- Initial PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE robot_status AS ENUM (
    'operational',
    'maintenance',
    'offline',
    'attention'
);

CREATE TYPE component_status AS ENUM (
    'healthy',
    'degrading',
    'critical',
    'replaced'
);

CREATE TYPE anomaly_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE anomaly_status AS ENUM (
    'open',
    'investigating',
    'resolved'
);

CREATE TYPE maintenance_type AS ENUM (
    'preventive',
    'corrective',
    'inspection',
    'component_replacement'
);

CREATE TYPE risk_level AS ENUM (
    'low',
    'moderate',
    'high',
    'critical'
);

-- ============================================================
-- PRODUCTION LINES
-- ============================================================

CREATE TABLE production_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    description TEXT,
    location VARCHAR(150),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROBOTS
-- ============================================================

CREATE TABLE robots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    line_id UUID NOT NULL
        REFERENCES production_lines(id)
        ON DELETE RESTRICT,

    name VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    model VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL,

    status robot_status NOT NULL DEFAULT 'operational',

    installation_date DATE NOT NULL,
    total_runtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT robots_runtime_non_negative
        CHECK (total_runtime_hours >= 0)
);

CREATE INDEX idx_robots_line_id
    ON robots(line_id);

CREATE INDEX idx_robots_status
    ON robots(status);

-- ============================================================
-- COMPONENTS
-- ============================================================

CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    robot_id UUID NOT NULL
        REFERENCES robots(id)
        ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    component_type VARCHAR(80) NOT NULL,
    manufacturer VARCHAR(100),

    installed_at DATE NOT NULL,

    expected_lifespan_hours NUMERIC(10, 2) NOT NULL,
    current_usage_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,

    health_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
    status component_status NOT NULL DEFAULT 'healthy',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT components_lifespan_positive
        CHECK (expected_lifespan_hours > 0),

    CONSTRAINT components_usage_non_negative
        CHECK (current_usage_hours >= 0),

    CONSTRAINT components_health_range
        CHECK (health_score >= 0 AND health_score <= 100)
);

CREATE INDEX idx_components_robot_id
    ON components(robot_id);

CREATE INDEX idx_components_status
    ON components(status);

-- ============================================================
-- SENSOR READINGS
-- ============================================================

CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    robot_id UUID NOT NULL
        REFERENCES robots(id)
        ON DELETE CASCADE,

    temperature_c NUMERIC(6, 2),
    vibration_mm_s NUMERIC(6, 2),
    motor_current_a NUMERIC(6, 2),
    pressure_bar NUMERIC(6, 2),

    recorded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sensor_readings_robot_time
    ON sensor_readings(robot_id, recorded_at DESC);

-- ============================================================
-- ANOMALIES
-- ============================================================

CREATE TABLE anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    robot_id UUID NOT NULL
        REFERENCES robots(id)
        ON DELETE CASCADE,

    sensor_reading_id UUID
        REFERENCES sensor_readings(id)
        ON DELETE SET NULL,

    anomaly_type VARCHAR(100) NOT NULL,
    severity anomaly_severity NOT NULL,

    description TEXT NOT NULL,

    status anomaly_status NOT NULL DEFAULT 'open',

    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,

    CONSTRAINT anomaly_resolution_time
        CHECK (
            resolved_at IS NULL
            OR resolved_at >= detected_at
        )
);

CREATE INDEX idx_anomalies_robot_status
    ON anomalies(robot_id, status);

CREATE INDEX idx_anomalies_severity
    ON anomalies(severity);

CREATE INDEX idx_anomalies_detected_at
    ON anomalies(detected_at DESC);

-- ============================================================
-- MAINTENANCE RECORDS
-- ============================================================

CREATE TABLE maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    robot_id UUID NOT NULL
        REFERENCES robots(id)
        ON DELETE CASCADE,

    component_id UUID
        REFERENCES components(id)
        ON DELETE SET NULL,

    maintenance_type maintenance_type NOT NULL,

    description TEXT NOT NULL,
    technician VARCHAR(120),

    cost NUMERIC(10, 2),

    performed_at TIMESTAMPTZ NOT NULL,
    next_due_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT maintenance_cost_non_negative
        CHECK (cost IS NULL OR cost >= 0),

    CONSTRAINT maintenance_schedule_valid
        CHECK (
            next_due_at IS NULL
            OR next_due_at >= performed_at
        )
);

CREATE INDEX idx_maintenance_robot_date
    ON maintenance_records(robot_id, performed_at DESC);

CREATE INDEX idx_maintenance_component
    ON maintenance_records(component_id);

CREATE INDEX idx_maintenance_next_due
    ON maintenance_records(next_due_at);

-- ============================================================
-- RISK ASSESSMENTS
-- ============================================================

CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    robot_id UUID NOT NULL
        REFERENCES robots(id)
        ON DELETE CASCADE,

    health_score NUMERIC(5, 2) NOT NULL,
    risk_score NUMERIC(5, 2) NOT NULL,

    risk_level risk_level NOT NULL,

    temperature_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    vibration_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    runtime_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    error_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    maintenance_score NUMERIC(5, 2) NOT NULL DEFAULT 0,

    primary_reason TEXT,
    recommendation TEXT,

    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT risk_health_range
        CHECK (health_score >= 0 AND health_score <= 100),

    CONSTRAINT risk_score_range
        CHECK (risk_score >= 0 AND risk_score <= 100)
);

CREATE INDEX idx_risk_robot_time
    ON risk_assessments(robot_id, calculated_at DESC);

CREATE INDEX idx_risk_level
    ON risk_assessments(risk_level);