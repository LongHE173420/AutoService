import { startWorker } from "./worker";

startWorker().catch((err) => {
  console.error("❌ Worker crashed:", err?.message || err);
  process.exit(1);
});
