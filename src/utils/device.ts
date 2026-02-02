import { randomUUID } from "crypto";

export function generateDeviceId() {
  return randomUUID();
}
