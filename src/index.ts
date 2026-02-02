
import fs from "fs";
import path from "path";
import { registerFromCsv } from "./services/register-from-csv.service";

const CSV_PATH = path.resolve(__dirname, "..", "users.csv");
const INTERVAL_MS = 60 * 1000;
let isRunning = false;
let watchTimer: NodeJS.Timeout | null = null;
async function runImportOnce() {
  if (isRunning) {
    console.log("⏳ Đang chạy lần trước, bỏ qua lần này");
    return;
  }

  isRunning = true;
  console.log("========================================");
  console.log(new Date().toISOString(), "▶ BẮT ĐẦU xử lý CSV");

  try {
    await registerFromCsv(CSV_PATH);
    console.log(new Date().toISOString(), "✅ XỬ LÝ CSV XONG");
  } catch (err: any) {
    console.error("❌ LỖI khi xử lý CSV:", err?.message || err);
  } finally {
    isRunning = false;
  }
}

async function main() {
  console.log("🚀 Auto-register CSV service đang chạy");
  console.log("📂 CSV_PATH =", CSV_PATH);

  await runImportOnce();
  setInterval(runImportOnce, INTERVAL_MS);
  if (fs.existsSync(CSV_PATH)) {
    fs.watch(CSV_PATH, (eventType) => {
      if (eventType === "change") {
        console.log("📝 users.csv vừa thay đổi, chuẩn bị xử lý lại...");
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => {
          runImportOnce();
        }, 2000); 
      }
    });

    console.log("👀 Đang watch file:", CSV_PATH);
  } else {
    console.warn("⚠️ Không tìm thấy users.csv tại:", CSV_PATH);
  }
}

// Giữ lại catch như bạn đang dùng
main().catch((err) => {
  console.error("❌ Lỗi chạy script:", err);
  process.exit(1);
});
