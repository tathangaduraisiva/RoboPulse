import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "robopulse-dev-secret";

// Extend the passport-defined Express.User interface so our custom fields
// are compatible with both passport's augmentation and our own usage.
declare global {
    namespace Express {
        interface User {
            id: string;
            username: string;
            role: string;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        res.status(401).json({
            success: false,
            message: "Authentication required",
        });
        return;
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET) as {
            sub: string;
            username: string;
            role: string;
        };

        req.user = {
            id: payload.sub,
            username: payload.username,
            role: payload.role,
        };

        next();
    } catch {
        res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
}
