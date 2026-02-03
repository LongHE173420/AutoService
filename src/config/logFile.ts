import fs from "fs";
import path from "path";
import { ENV } from "./env";

export function ensureLogDir() {
  const dir = path.resolve(process.cwd(), "data", "logs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getTodayLogPath() {
  const dir = ensureLogDir();
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const fileName = `worker-${yyyy}-${mm}-${dd}.log`;
  return {
    fileName,
    filePath: path.join(dir, fileName),
  };
}

export function cleanupOldLogs() {
  const dir = ensureLogDir();
  const keepMs = ENV.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    try {
      const st = fs.statSync(full);
      if (st.isFile() && now - st.mtimeMs > keepMs) {
        fs.unlinkSync(full);
      }
    } catch {
      // ignore
    }
  }
}
