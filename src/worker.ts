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

    
    const { fileName, filePath } = getTodayLogPath();
    const logId = await ensureLogRow(fileName, filePath);

   
    const logger = createFileLogger(filePath).child({
      fileName,
      filePath,
      logId,
    });

    logger.info({ reason, csvPath }, "JOB_START");


    const ctx = { logId, logger };

    const reg = await registerFromCsv(csvPath, ctx);
    const log = await loginFromDb(ctx);

    logger.info({ reg, log }, "JOB_DONE");


    console.log(
      `REGISTER summary: success=${reg.success} pending=${reg.pending} fail=${reg.fail}`
    );
    console.log(
      `LOGIN summary: success=${log.success} pending=${log.pending} fail=${log.fail}`
    );
  } catch {

    console.log("REGISTER summary: success=0 pending=0 fail=0");
    console.log("LOGIN summary: success=0 pending=0 fail=0");
  } finally {
    isRunning = false;
  }
}

export async function startWorker() {
  const csvPath = resolveCsvPath();

  await runOnce("startup");
  setInterval(() => runOnce("interval"), ENV.INTERVAL_MS);

  if (fs.existsSync(csvPath)) {
    fs.watch(csvPath, (eventType) => {
      if (eventType === "change") {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => runOnce("csv changed"), 1200);
      }
    });
  }
}
