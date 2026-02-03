// src/worker.ts
import fs from "fs";
import path from "path";
import { ENV } from "./config/env";
import { cleanupOldLogs, getTodayLogPath } from "./config/logFile";
import { ensureLogRow } from "./repo/log.repo";
import { createFileLogger } from "./config/logger";
import { registerFromCsv } from "./services/register-from-csv.service";
import { loginFromDb } from "./services/login-from-db.service";

let isRunning = false;
let watchTimer: NodeJS.Timeout | null = null;

function resolveCsvPath() {
  return path.resolve(process.cwd(), ENV.CSV_PATH);
}

async function runOnce(reason: string) {
  if (isRunning) return;
  isRunning = true;

  const csvPath = resolveCsvPath();

  try {
    cleanupOldLogs();

    // 1) tạo log file + lưu tbl_log
    const { fileName, filePath } = getTodayLogPath();
    const logId = await ensureLogRow(fileName, filePath);

    // 2) tạo logger ghi FILE ONLY
    const logger = createFileLogger(filePath);
    logger.info({ fileName, filePath, logId }, "log initialized");
    logger.info({ reason, csvPath }, "JOB_START");

    // 3) chạy register + login (log chi tiết vào FILE)
    const reg = await registerFromCsv(csvPath, logId, logger);
    const log = await loginFromDb(logId, logger);

    logger.info({ reg, log }, "JOB_DONE");

    // ✅ 4) TERMINAL: chỉ in 2 dòng summary
    console.log(`REGISTER summary: success=${reg.success} pending=${reg.pending} fail=${reg.fail}`);
    console.log(`LOGIN summary: success=${log.success} pending=${log.pending} fail=${log.fail}`);
  } catch (e: any) {
    // ❗ terminal không in lỗi chi tiết nữa theo yêu cầu
    console.log("REGISTER summary: success=0 pending=0 fail=0");
    console.log("LOGIN summary: success=0 pending=0 fail=0");
  } finally {
    isRunning = false;
  }
}

export async function startWorker() {
  const csvPath = resolveCsvPath();

  // startup run
  await runOnce("startup");

  // interval
  setInterval(() => runOnce("interval"), ENV.INTERVAL_MS);

  // watch csv
  if (fs.existsSync(csvPath)) {
    fs.watch(csvPath, (eventType) => {
      if (eventType === "change") {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => runOnce("csv changed"), 1200);
      }
    });
  }
}
