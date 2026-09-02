import { loginUser, registerUser } from "../services/auth.service.js";
export async function login(req, res) {
    try {
        const { username, password } = req.body ?? {};
        if (!username || typeof username !== "string" || !username.trim()) {
            res.status(400).json({
                success: false,
                message: "Username is required",
            });
            return;
        }
        if (!password || typeof password !== "string" || !password.trim()) {
            res.status(400).json({
                success: false,
                message: "Password is required",
            });
            return;
        }
        const authResult = await loginUser(username, password);
        res.status(200).json({
            success: true,
            token: authResult.token,
            user: authResult.user,
        });
    }
    catch (error) {
        console.error("[Auth Controller] Login error:", error instanceof Error ? error.message : error);
        const message = error instanceof Error && "statusCode" in error && error.statusCode === 401
            ? "Invalid username or password"
            : "Unable to authenticate user";
        res.status(error instanceof Error && "statusCode" in error && error.statusCode === 401 ? 401 : 500).json({
            success: false,
            message,
        });
    }
}
export async function register(req, res) {
    try {
        const { name, email, password, confirmPassword } = req.body ?? {};
        if (!name || typeof name !== "string" || !name.trim()) {
            res.status(400).json({
                success: false,
                message: "Full name is required",
            });
            return;
        }
        if (!email || typeof email !== "string" || !email.trim()) {
            res.status(400).json({
                success: false,
                message: "Please enter a valid email address.",
            });
            return;
        }
        if (!password || typeof password !== "string" || !password.trim()) {
            res.status(400).json({
                success: false,
                message: "Password is required",
            });
            return;
        }
        if (typeof confirmPassword !== "string" || confirmPassword !== password) {
            res.status(400).json({
                success: false,
                message: "Passwords do not match.",
            });
            return;
        }
        const user = await registerUser(name, email, password);
        res.status(201).json({
            success: true,
            message: "Account created successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    }
    catch (error) {
        console.error("[Auth Controller] Registration error:", error instanceof Error ? error.message : error);
        const statusCode = error instanceof Error && "statusCode" in error ? Number(error.statusCode) : 500;
        const message = error instanceof Error && error.message === "An account with this email already exists."
            ? "An account with this email already exists."
            : error instanceof Error && error.message === "Please enter a valid email address."
                ? "Please enter a valid email address."
                : error instanceof Error && error.message === "Passwords do not match."
                    ? "Passwords do not match."
                    : error instanceof Error && error.message.includes("Password must be at least 8 characters")
                        ? error.message
                        : "Unable to create your account. Please try again.";
        res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
            success: false,
            message,
        });
    }
}
