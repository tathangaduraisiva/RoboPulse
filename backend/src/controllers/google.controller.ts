import type { Request, Response, NextFunction } from "express";
import passport from "passport";
import { isGoogleOAuthConfigured, mintJwt } from "../services/google.service.js";
import type { AuthUserSummary } from "../services/auth.service.js";

// The frontend URL we redirect back to after OAuth completes.
// Falls back to localhost:5173 for local development.
function frontendUrl(): string {
    return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth consent flow.
 * Returns 503 if Google OAuth is not configured.
 */
export function googleInitiate(req: Request, res: Response, next: NextFunction): void {
    if (!isGoogleOAuthConfigured()) {
        res.status(503).json({
            success: false,
            message: "Google authentication is not configured on this server.",
        });
        return;
    }

    passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
    })(req, res, next);
}

/**
 * GET /api/auth/google/callback
 *
 * Handles the Google OAuth redirect.  On success, mints a JWT and
 * redirects the browser to the frontend callback page with the token
 * in the URL hash (never in a query string, to avoid server logs).
 *
 * On failure, redirects to the login page with an ?error= parameter.
 */
export function googleCallback(req: Request, res: Response, next: NextFunction): void {
    passport.authenticate(
        "google",
        { session: false, failWithError: true },
        (err: unknown, user: AuthUserSummary | false) => {
            if (err || !user) {
                console.error(
                    "[Google OAuth Callback] Authentication failed:",
                    err instanceof Error ? err.message : err
                );
                // Redirect to frontend login page with a sanitised error flag
                res.redirect(`${frontendUrl()}/?google_error=auth_failed`);
                return;
            }

            try {
                const token = mintJwt(user);
                // Pass token + user info via URL hash — not visible in server access logs
                const payload = encodeURIComponent(
                    JSON.stringify({
                        token,
                        user: {
                            id: user.id,
                            username: user.username,
                            name: user.name,
                            email: user.email,
                            role: user.role,
                        },
                    })
                );
                res.redirect(`${frontendUrl()}/auth/callback#token=${payload}`);
            } catch (mintErr: unknown) {
                console.error(
                    "[Google OAuth Callback] JWT mint error:",
                    mintErr instanceof Error ? mintErr.message : mintErr
                );
                res.redirect(`${frontendUrl()}/?google_error=token_error`);
            }
        }
    )(req, res, next);
}

/**
 * GET /api/auth/google/status
 *
 * Lets the frontend check whether Google OAuth is configured
 * without leaking any credentials.
 */
export function googleStatus(_req: Request, res: Response): void {
    res.json({
        success: true,
        configured: isGoogleOAuthConfigured(),
    });
}
