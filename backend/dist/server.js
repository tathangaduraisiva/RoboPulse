import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { checkDatabaseConnection, verifyDatabaseSchema } from "./db/postgres.js";
import { connectRedis } from "./config/redis.js";
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
app.use(cors());
app.use(express.json());
// REST Endpoints
app.use("/api/auth", authRoutes);
app.use("/api/robots", robotRoutes);
app.use("/api/robots", sensorRoutes);
app.use("/api/production-lines", productionLineRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/technicians", technicianRoutes);
app.get("/api/health", async (_req, res) => {
    res.json({
        success: true,
        service: "RoboPulse API",
        status: "operational",
        timestamp: new Date().toISOString(),
    });
});
async function startServer() {
    try {
        await checkDatabaseConnection();
        await verifyDatabaseSchema();
        await connectRedis();
        app.listen(PORT, () => {
            console.log(`✓ RoboPulse API running on http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error("✗ Failed to start RoboPulse API:", error);
        process.exit(1);
    }
}
startServer();
