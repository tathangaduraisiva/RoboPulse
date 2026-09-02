import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "robopulse-dev-secret";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                username: string;
                role: string;
            };
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
