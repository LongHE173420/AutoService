import { redis } from "../config/redis";

export type RedisOtpRecord = {
  otp: string;
  sender: string;
  text: string;
  timestamp: string;   
  received_at: string; 
  port: string;
  imei: string;
  index: number;
};

function buildOtpKey(rawPhone: string): string {
  let p = String(rawPhone || "").trim();
  p = p.replace(/\D/g, "");

  if (p.startsWith("84") && p.length > 2) {
    p = "0" + p.slice(2);
  }
  if (p.startsWith("0") === false && p.length >= 9) {
    p = "0" + p;
  }

  return `otp:_${p}`;
}

export async function getOtpFromRedis(
  phone: string
): Promise<RedisOtpRecord | null> {
  const key = buildOtpKey(phone);

  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }

  try {
    const data = JSON.parse(raw);
    if (!data || typeof data.otp !== "string") {
      console.warn("[otp-redis] data invalid for key:", key, raw);
      return null;
    }

    return data as RedisOtpRecord;
  } catch (e) {
    console.error("[otp-redis] JSON parse error:", e);
    return null;
  }
}
export async function waitForOtpFromRedis(
  phone: string,
  timeoutMs: number = 60_000,
  pollMs: number = 2_000
): Promise<RedisOtpRecord | null> {
  const start = Date.now();
  let lastOtp: string | undefined;

  while (Date.now() - start < timeoutMs) {
    const rec = await getOtpFromRedis(phone);
    if (rec && rec.otp && rec.otp !== lastOtp) {
      return rec;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  return null; 
}
