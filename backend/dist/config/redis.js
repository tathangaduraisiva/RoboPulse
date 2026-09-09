import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();
export const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6380,
        reconnectStrategy: (retries) => {
            // Stop retrying after 3 attempts to avoid noise; fall back to live queries
            if (retries >= 3)
                return false;
            return Math.min(retries * 200, 1000);
        },
    },
});
redisClient.on("error", (error) => {
    // Log once per error type; do not crash
    console.warn("[Redis] Connection error (cache disabled):", error.message);
});
export async function connectRedis() {
    if (redisClient.isOpen) {
        console.log("✓ Redis already connected");
        return;
    }
    await redisClient.connect();
    console.log("✓ Redis connection established");
}
