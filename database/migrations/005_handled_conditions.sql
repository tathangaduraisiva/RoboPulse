-- ============================================================
-- RoboPulse Migration 005
-- Handled Condition Tracking for Duplicate-Critical Prevention
--
-- Safe / Idempotent: uses CREATE TABLE IF NOT EXISTS and
-- ADD COLUMN IF NOT EXISTS — never drops or recreates tables.
-- ============================================================

-- ------------------------------------------------------------
-- 1. handled_conditions table
--    Records every diagnosed condition that has been handled
--    so the prediction engine can suppress stale re-detections.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS handled_conditions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    robot_id            UUID NOT NULL
                            REFERENCES robots(id) ON DELETE CASCADE,

    -- Deterministic fingerprint: robotId + category + dominant signal bucket
    condition_fingerprint VARCHAR(120) NOT NULL,

    -- Human-readable category for logging/display
    condition_category  VARCHAR(60) NOT NULL,

    -- Snapshot of telemetry values at the time of handling
    telemetry_temp_c    NUMERIC(6, 2),
    telemetry_vib_mm_s  NUMERIC(6, 2),
    telemetry_current_a NUMERIC(6, 2),
    telemetry_pressure_bar NUMERIC(6, 2),

    -- Sensor reading timestamp at time of diagnosis (latest reading when diagnosed)
    diagnosed_telemetry_at TIMESTAMPTZ,

    -- Link to the maintenance record that resolved this condition
    maintenance_record_id UUID
                            REFERENCES maintenance_records(id) ON DELETE SET NULL,

    -- When the condition was marked handled
    handled_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- resolved | monitoring | recurring | new_issue | active
    resolution_status   VARCHAR(30) NOT NULL DEFAULT 'resolved',

    -- Suppress re-detection until this timestamp
    -- After this window, new telemetry may trigger a fresh condition
    suppression_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handled_conditions_robot
    ON handled_conditions(robot_id);

CREATE INDEX IF NOT EXISTS idx_handled_conditions_fingerprint
    ON handled_conditions(robot_id, condition_fingerprint);

CREATE INDEX IF NOT EXISTS idx_handled_conditions_suppression
    ON handled_conditions(robot_id, suppression_expires_at DESC);

-- ------------------------------------------------------------
-- 2. Add condition_fingerprint column to maintenance_records
--    so each completed maintenance knows which condition it
--    addressed (idempotent).
-- ------------------------------------------------------------
ALTER TABLE maintenance_records
    ADD COLUMN IF NOT EXISTS condition_fingerprint VARCHAR(120),
    ADD COLUMN IF NOT EXISTS condition_handled_at  TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 3. Add condition_fingerprint index on maintenance_records
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_maintenance_condition_fp
    ON maintenance_records(robot_id, condition_fingerprint)
    WHERE condition_fingerprint IS NOT NULL;
