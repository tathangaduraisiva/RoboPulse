-- ============================================================
-- RoboPulse Migration 002
-- Adds: users, technicians, technician_robot_assignments
-- Also ensures anomalies table has required seed rows
-- ============================================================

-- ============================================================
-- USERS (authentication)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL DEFAULT 'User',
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;

-- ============================================================
-- TECHNICIANS
-- ============================================================

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

-- ============================================================
-- TECHNICIAN → ROBOT ASSIGNMENTS
-- ============================================================

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
