import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import passport from "passport";
import jwt from "jsonwebtoken";
import { pool } from "../db/postgres.js";
import type { AuthUserSummary } from "./auth.service.js";

const JWT_SECRET = process.env.JWT_SECRET || "robopulse-dev-secret";

export interface GoogleOAuthResult {
    token: string;
    user: AuthUserSummary;
    isNewUser: boolean;
}

/**
 * Returns true only when all three required Google OAuth environment
 * variables are set to non-empty strings.
 */
export function isGoogleOAuthConfigured(): boolean {
    return (
        Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
        Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()) &&
        Boolean(process.env.GOOGLE_CALLBACK_URL?.trim())
    );
}

/**
 * Find an existing user by Google ID, or by email (for accounts that
 * registered with username/password before linking Google), or create
 * a brand-new OAuth-only record.
 *
 * Returns the upserted/found user row.
 */
export async function findOrCreateGoogleUser(
    googleId: string,
    email: string,
    displayName: string,
    avatarUrl: string | null
): Promise<AuthUserSummary> {
    const safeEmail = email.trim().toLowerCase();
    const safeName = displayName.trim() || safeEmail.split("@")[0];

    // 1. Try to find by google_id first (returning user who already did OAuth)
    const byGoogleId = await pool.query(
        `SELECT id, name, username, email, role
         FROM users
         WHERE google_id = $1
         LIMIT 1`,
        [googleId]
    );

    if (byGoogleId.rows[0]) {
        // Update avatar URL in case it changed (non-critical)
        await pool.query(
            `UPDATE users SET google_avatar_url = $1, updated_at = NOW() WHERE google_id = $2`,
            [avatarUrl, googleId]
        );
        const u = byGoogleId.rows[0];
        return { id: u.id, username: u.username, name: u.name, email: u.email, role: u.role };
    }

    // 2. Try to find by email — link existing password-based account to Google
    const byEmail = await pool.query(
        `SELECT id, name, username, email, role
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [safeEmail]
    );

    if (byEmail.rows[0]) {
        // Link the Google ID to the existing account
        await pool.query(
            `UPDATE users
             SET google_id = $1, google_avatar_url = $2, updated_at = NOW()
             WHERE LOWER(email) = LOWER($3)`,
            [googleId, avatarUrl, safeEmail]
        );
        const u = byEmail.rows[0];
        return { id: u.id, username: u.username, name: u.name, email: u.email, role: u.role };
    }

    // 3. Brand-new Google user — create account (no password_hash)
    // Derive a unique username from the email local-part; append digits if taken.
    const baseUsername = safeEmail.split("@")[0].replace(/[^a-z0-9_]/g, "_");
    let username = baseUsername;
    let suffix = 0;

    while (true) {
        const conflict = await pool.query(
            `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
            [username]
        );
        if (!conflict.rows[0]) break;
        suffix += 1;
        username = `${baseUsername}${suffix}`;
    }

    const result = await pool.query(
        `INSERT INTO users
             (name, username, email, password_hash, google_id, google_avatar_url, role, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, $4, $5, 'operator', NOW(), NOW())
         RETURNING id, name, username, email, role`,
        [safeName, username, safeEmail, googleId, avatarUrl]
    );

    const newUser = result.rows[0];
    return {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
    };
}

/**
 * Mint the same JWT format that the existing loginUser() service produces
 * so the frontend token handling is 100% identical.
 */
export function mintJwt(user: AuthUserSummary): string {
    return jwt.sign(
        {
            sub: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
        },
        JWT_SECRET,
        { expiresIn: "8h" }
    );
}

/**
 * Register the Passport Google strategy.
 * Called once during server startup, only when OAuth is configured.
 */
export function registerGoogleStrategy(): void {
    const clientID = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const callbackURL = process.env.GOOGLE_CALLBACK_URL!;

    passport.use(
        new GoogleStrategy(
            {
                clientID,
                clientSecret,
                callbackURL,
                scope: ["profile", "email"],
            },
            async (_accessToken, _refreshToken, profile, done) => {
                try {
                    const email =
                        profile.emails?.[0]?.value ?? `${profile.id}@google.oauth`;
                    const displayName = profile.displayName || profile.id;
                    const avatarUrl = profile.photos?.[0]?.value ?? null;

                    const user = await findOrCreateGoogleUser(
                        profile.id,
                        email,
                        displayName,
                        avatarUrl
                    );
                    done(null, user);
                } catch (err: unknown) {
                    console.error(
                        "[GoogleStrategy] Error during find-or-create:",
                        err instanceof Error ? err.message : err
                    );
                    done(err instanceof Error ? err : new Error("OAuth error"), undefined);
                }
            }
        )
    );
}
