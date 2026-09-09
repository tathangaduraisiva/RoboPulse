import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
import { checkDatabaseConnection, verifyDatabaseSchema } from "./db/postgres.js";
import { connectRedis } from "./config/redis.js";
import { syncAllRobotStatuses } from "./services/robot.service.js";
import { startTelemetryScheduler, stopTelemetryScheduler } from "./services/telemetryScheduler.js";
import { isGoogleOAuthConfigured, registerGoogleStrategy } from "./services/google.service.js";
import robotRoutes from "./routes/robot.routes.js";
import sensorRoutes from "./routes/sensor.routes.js";
import productionLineRoutes from "./routes/productionLine.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import predictionRoutes from "./routes/prediction.routes.js";
import authRoutes from "./routes/auth.routes.js";
import technicianRoutes from "./routes/technician.routes.js";
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT) || 5000;
// Allow requests from the Vite dev server and the same origin
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.FRONTEND_URL,
].filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, same-origin)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(null, true); // permissive for dev; tighten for prod
        }
    },
    credentials: true,
}));
app.use(express.json());
app.use(passport.initialize());
// REST Endpoints
app.use("/api/auth", authRoutes);
app.use("/api/robots", robotRoutes);
app.use("/api/robots", sensorRoutes);
app.use("/api/production-lines", productionLineRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/technicians", technicianRoutes);
app.get("/api/health", (_req, res) => {
    res.json({
        success: true,
        service: "RoboPulse API",
        status: "operational",
        timestamp: new Date().toISOString(),
    });
});
// Central error handler — catches errors passed via next(err)
app.use((err, _req, res, _next) => {
    console.error("[Unhandled Express Error]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
});
// Prevent uncaught async rejections from killing the process silently
process.on("unhandledRejection", (reason) => {
    console.error("[UnhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
    console.error("[UncaughtException]", err);
});
async function startServer() {
    try {
        await checkDatabaseConnection();
        await verifyDatabaseSchema();
    }
    catch (error) {
        console.error("✗ Failed to start RoboPulse API (database):", error);
        process.exit(1);
    }
    // Register Google OAuth strategy only when credentials are present
    if (isGoogleOAuthConfigured()) {
        registerGoogleStrategy();
        console.log("✓ Google OAuth strategy registered");
    }
    else {
        console.log("ℹ  Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL not set)");
    }
    // Redis is non-fatal — prediction engine falls back to live PostgreSQL queries
    try {
        await connectRedis();
    }
    catch (error) {
        console.warn("⚠  Redis unavailable — prediction cache disabled, falling back to live queries:", error instanceof Error ? error.message : error);
    }
    // Authoritatively synchronize all robot statuses across PostgreSQL & Redis on startup
    await syncAllRobotStatuses();
    console.log("✓ Fleet robot statuses synchronized");
    const server = app.listen(PORT, () => {
        console.log(`✓ RoboPulse API running on http://localhost:${PORT}`);
    });
    // Start the single global telemetry scheduler at 2 000 ms cadence.
    startTelemetryScheduler();
    // Graceful shutdown — stop the scheduler before the process exits.
    const shutdown = () => {
        stopTelemetryScheduler();
        server.close(() => process.exit(0));
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
}
startServer();
