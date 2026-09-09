import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

export const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6380,

        // Enable TLS only when REDIS_TLS=true.
        // This works with Upstash in production while
        // keeping local Docker Redis without TLS.
        ...(process.env.REDIS_TLS === "true" ? { tls: true } : {}),

        reconnectStrategy: (retries) => {
            // Stop retrying after 3 attempts.
            // The application can fall back to PostgreSQL.
            if (retries >= 3) return false;

            return Math.min(retries * 200, 1000);
        },
    },

    // Required for authenticated Redis providers such as Upstash.
    password: process.env.REDIS_PASSWORD,
});

redisClient.on("error", (error: Error) => {
    // Redis is non-fatal; the application can fall back to PostgreSQL.
    console.warn(
        "[Redis] Connection error (cache disabled):",
        error.message
    );
});

export async function connectRedis(): Promise<void> {
    if (redisClient.isOpen) {
        console.log("✓ Redis already connected");
        return;
    }

    await redisClient.connect();

    console.log("✓ Redis connection established");
}