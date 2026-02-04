// src/config/logger.ts
import fs from "fs";
import path from "path";
import { Writable } from "stream";
import pino from "pino";

function toIsoTime(t: any): string {
  if (typeof t === "number") return new Date(t).toISOString();
  if (typeof t === "string") return t;
  return new Date().toISOString();
}

function normalizeErr(err: any): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (typeof err?.name === "string") return err.name;
  if (typeof err?.message === "string") return err.message;
  return String(err);
}

function formatLine(o: any): string {
  // ✅ chỉ giữ đúng 6 field mày cần
  const fields: Array<[string, any]> = [
    ["time", toIsoTime(o?.time)],
    ["logId", o?.logId],
    ["phone", o?.phone],
    ["deviceId", o?.deviceId],
    ["err", normalizeErr(o?.err)],
    ["msg", o?.msg],
  ];

  return fields
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `"${k}":${JSON.stringify(v)}`)
    .join(",");
}

class KvOnlyStream extends Writable {
  private buf = "";
  constructor(private out: fs.WriteStream) {
    super();
  }

  _write(chunk: any, _enc: BufferEncoding, cb: (error?: Error | null) => void) {
    this.buf += chunk.toString("utf8");

    let idx = 0;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);

      if (!line) continue;

      try {
        const obj = JSON.parse(line); // ✅ JSON hợp lệ
        this.out.write(formatLine(obj) + "\n");
      } catch {
        // fallback nếu có dòng rác
        this.out.write(line + "\n");
      }
    }

    cb();
  }
}

export function createFileLogger(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const out = fs.createWriteStream(filePath, { flags: "a", encoding: "utf8" });
  const stream = new KvOnlyStream(out);

  // ✅ để pino xuất JSON chuẩn rồi stream lọc field
  return pino(
    {
      base: null,        // bỏ pid/hostname
      messageKey: "msg", // msg nằm trong key "msg"
    },
    stream
  );
}
