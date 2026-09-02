-- ============================================================
-- RoboPulse Migration 004
-- Ensures the users table supports registration with name/email fields
-- ============================================================

ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT 'User';

ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255);

ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE users
SET name = COALESCE(name, 'User'),
    updated_at = COALESCE(updated_at, created_at, NOW())
WHERE name IS NULL OR updated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
    ON users(email)
    WHERE email IS NOT NULL;
