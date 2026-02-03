import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379/4";

export const redis = createClient({ url: REDIS_URL });

redis.on("error", (err) => {
  console.error("[authService redis] error:", err);
});

export async function initRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    console.log("[authService redis] connected to", REDIS_URL);
  }
}
