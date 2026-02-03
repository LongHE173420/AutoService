// src/config/logger.ts
import pino, { type Logger } from "pino";
import fs from "fs";
import path from "path";

export function createFileLogger(filePath: string): Logger {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  return pino(
    {
      base: { app: "ResAuto1" },
      timestamp: pino.stdTimeFunctions.isoTime, // field "time"
      // ✅ bỏ pid/hostname (đỡ rác)
      formatters: {
        bindings: () => ({}),
        // ✅ bỏ level đúng cách (trả object rỗng, KHÔNG trả string)
        level: () => ({}),
      },
    },
    pino.destination({ dest: filePath, sync: false }) // ✅ chỉ ghi file
  );
}
