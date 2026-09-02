import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/postgres.js";
const JWT_SECRET = process.env.JWT_SECRET || "robopulse-dev-secret";
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isStrongPassword(password) {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}
export async function registerUser(name, email, password) {
    const safeName = name.trim();
    const normalizedEmail = normalizeEmail(email);
    if (!safeName) {
        throw Object.assign(new Error("Full name is required"), { statusCode: 400 });
    }
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
        throw Object.assign(new Error("Please enter a valid email address."), { statusCode: 400 });
    }
    if (!password || !isStrongPassword(password)) {
        throw Object.assign(new Error("Password must be at least 8 characters and include uppercase, lowercase, and a number."), { statusCode: 400 });
    }
    let existingUser;
    try {
        existingUser = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) LIMIT 1`, [normalizedEmail]);
    }
    catch (dbError) {
        console.error("[Auth Service] Duplicate check failed:", dbError instanceof Error ? dbError.message : dbError);
        throw Object.assign(new Error("Unable to create your account. Please try again."), { statusCode: 500 });
    }
    if (existingUser.rows[0]) {
        throw Object.assign(new Error("An account with this email already exists."), { statusCode: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    let result;
    try {
        result = await pool.query(`INSERT INTO users (name, username, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'operator', NOW(), NOW())
             RETURNING id, name, username, email, role`, [safeName, normalizedEmail, normalizedEmail, passwordHash]);
    }
    catch (dbError) {
        console.error("[Auth Service] Registration insert failed:", dbError instanceof Error ? dbError.message : dbError);
        throw Object.assign(new Error("Unable to create your account. Please try again."), { statusCode: 500 });
    }
    const newUser = result.rows[0];
    return {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
    };
}
export async function loginUser(username, password) {
    const safeIdentifier = username.trim();
    if (!safeIdentifier || !password) {
        console.log("[Auth Service] Validation failed: empty username or password");
        throw Object.assign(new Error("Invalid username or password"), { statusCode: 401 });
    }
    let result;
    try {
        result = await pool.query(`SELECT id, name, username, email, password_hash, role
             FROM users
             WHERE LOWER(username) = LOWER($1)
                OR LOWER(email) = LOWER($1)
             LIMIT 1`, [safeIdentifier]);
    }
    catch (dbError) {
        console.error("[Auth Service] Database query failed:", dbError instanceof Error ? dbError.message : dbError);
        throw Object.assign(new Error("Database connection error"), { statusCode: 500 });
    }
    const user = result.rows[0];
    if (!user) {
        console.log(`[Auth Service] User not found: ${safeIdentifier}`);
        throw Object.assign(new Error("Invalid username or password"), { statusCode: 401 });
    }
    let passwordMatches = false;
    try {
        passwordMatches = await bcrypt.compare(password, user.password_hash);
    }
    catch (hashError) {
        console.error("[Auth Service] Bcrypt comparison failed:", hashError instanceof Error ? hashError.message : hashError);
        throw Object.assign(new Error("Authentication failed"), { statusCode: 500 });
    }
    if (!passwordMatches) {
        console.log(`[Auth Service] Password mismatch for user: ${safeIdentifier}`);
        throw Object.assign(new Error("Invalid username or password"), { statusCode: 401 });
    }
    console.log(`[Auth Service] Successful login for user: ${safeIdentifier}`);
    const token = jwt.sign({
        sub: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
    }, JWT_SECRET, { expiresIn: "8h" });
    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    };
}
export async function changeUserPassword(userId, currentPassword, newPassword) {
    if (!userId || !currentPassword || !newPassword) {
        throw Object.assign(new Error("All password fields are required"), { statusCode: 400 });
    }
    if (!isStrongPassword(newPassword)) {
        throw Object.assign(new Error("Password must be at least 8 characters and include uppercase, lowercase, and a number."), { statusCode: 400 });
    }
    const result = await pool.query(`SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1`, [userId]);
    const user = result.rows[0];
    if (!user) {
        throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }
    const currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentMatches) {
        throw Object.assign(new Error("Current password is incorrect"), { statusCode: 400 });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, userId]);
}
