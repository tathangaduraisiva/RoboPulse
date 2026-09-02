-- ============================================================
-- RoboPulse Migration 003
-- Adds auth seed user and default alert records
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in_progress', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_robot_id ON alerts(robot_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

INSERT INTO users (id, username, password_hash, role, created_at)
VALUES (
    '40000000-0000-0000-0000-000000000001',
    'admin',
    '$2b$10$6bzDSQLrStdHEAs6L3SGC.0YmKjwJL9KnQMVZSm85evTzDFYnIwz6',
    'admin',
    NOW()
)
ON CONFLICT (username)
DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    created_at = COALESCE(users.created_at, EXCLUDED.created_at);

INSERT INTO alerts (id, robot_id, type, severity, message, status, created_at, updated_at)
VALUES
    (
        '50000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000003',
        'Temperature',
        'medium',
        'Motor temperature above recommended operating range',
        'new',
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '2 hours'
    ),
    (
        '50000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000006',
        'Vibration',
        'high',
        'Elevated vibration detected in recent sensor readings',
        'new',
        NOW() - INTERVAL '4 hours',
        NOW() - INTERVAL '4 hours'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO technicians (id, name, employee_code, specialization, phone, email, status, created_at, updated_at)
VALUES
    (
        '60000000-0000-0000-0000-000000000001',
        'Marcus Webb',
        'TECH-001',
        'mechanical',
        '+1 (555) 201-4821',
        'm.webb@robopulse.io',
        'assigned',
        NOW(),
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000002',
        'Sarah Okafor',
        'TECH-002',
        'electrical',
        '+1 (555) 334-7102',
        's.okafor@robopulse.io',
        'available',
        NOW(),
        NOW()
    )
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO technician_robot_assignments (id, technician_id, robot_id, assigned_at, unassigned_at)
VALUES (
    '70000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    NOW() - INTERVAL '1 day',
    NULL
)
ON CONFLICT (technician_id, robot_id) DO NOTHING;
