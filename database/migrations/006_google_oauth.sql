-- ============================================================
-- RoboPulse Migration 006
-- Adds Google OAuth support to the existing users table.
--
-- Changes:
--   1. Add google_id column (unique, nullable) — stores the
--      stable Google "sub" identifier for OAuth users.
--   2. Add google_avatar_url column — stores the profile photo
--      URL returned by Google (informational only).
--   3. Make password_hash nullable — Google-only users have no
--      local password; existing users are unaffected.
--   4. Add a partial unique index on google_id where NOT NULL.
-- ============================================================

-- 1. Add google_id (nullable; populated only for OAuth users)
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS google_id VARCHAR(128);

-- 2. Add google_avatar_url (optional, display only)
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS google_avatar_url TEXT;

-- 3. Make password_hash nullable so Google-only accounts are valid
--    (existing rows already have a hash value — this is safe)
ALTER TABLE IF EXISTS users
    ALTER COLUMN password_hash DROP NOT NULL;

-- 4. Unique index on google_id for fast OAuth look-ups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
    ON users(google_id)
    WHERE google_id IS NOT NULL;
