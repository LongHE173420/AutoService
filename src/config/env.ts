import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: true,
  debug: false,
  quiet: true,
} as any);

function num(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function str(v: any, def: string) {
  const s = String(v ?? "").trim();
  return s ? s : def;
}

export const ENV = {
  
  BASE_URL: str(process.env.BASE_URL, "http://localhost:3000"),

 
  MYSQL_HOST: str(process.env.MYSQL_HOST, "127.0.0.1"),
  MYSQL_PORT: num(process.env.MYSQL_PORT, 3306),
  MYSQL_USER: str(process.env.MYSQL_USER, "root"),
  MYSQL_PASSWORD: str(process.env.MYSQL_PASSWORD, ""),
  MYSQL_DATABASE: str(process.env.MYSQL_DATABASE, "auth_service"),
  MYSQL_CONN_LIMIT: num(process.env.MYSQL_CONN_LIMIT, 10),

  CSV_PATH: str(process.env.CSV_PATH, "users.csv"),
  INTERVAL_MS: num(process.env.INTERVAL_MS, 60_000),
  LOGIN_LIMIT: num(process.env.LOGIN_LIMIT, 50),
  LOGIN_COOLDOWN_MIN: num(process.env.LOGIN_COOLDOWN_MIN, 10),
  CONCURRENCY: num(process.env.CONCURRENCY, 5),

  REDIS_URL: str(process.env.REDIS_URL, "redis://127.0.0.1:6379"),
  REDIS_DB: num(process.env.REDIS_DB, 4),
  OTP_TIMEOUT_MS: num(process.env.OTP_TIMEOUT_MS, 60_000),
  OTP_POLL_MS: num(process.env.OTP_POLL_MS, 2_000),


  LOG_RETENTION_DAYS: num(process.env.LOG_RETENTION_DAYS, 7),
};

