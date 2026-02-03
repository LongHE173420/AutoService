import fs from "fs";
import { parse } from "csv-parse/sync";
import { generateDeviceId } from "../utils/device";
import { logger } from "../config/logger";
import { ENV } from "../config/env";
import {
  registerUser,
  verifyRegisterOtpApi,
  type RegisterPayload,
  type ApiRes,
} from "../api/auth.api";
import { waitForOtpFromRedis } from "./otp-redis.service";
import { findUserIdByPhone, insertAuthStatus, insertUserAction } from "../repo/audit.repo";

type CsvRow = {
  phone: string;
  password: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
};

function isAlreadyExists(msg: string) {
  const m = msg.toLowerCase();
  return m.includes("đã tồn tại") || m.includes("tồn tại");
}

export async function registerFromCsv(filePath: string, logId: number) {
  if (!fs.existsSync(filePath)) return { success: 0, pending: 0, fail: 0 };

  const content = fs.readFileSync(filePath);
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  if (!Array.isArray(records) || records.length === 0) {
    return { success: 0, pending: 0, fail: 0 };
  }

  let success = 0;
  let pending = 0;
  let fail = 0;

  for (const row of records) {
    const phone = String(row.phone || "").trim();
    const password = String(row.password || "").trim();
    if (!phone || !password) continue;

    const deviceId = generateDeviceId();

    const payload: RegisterPayload = {
      phone,
      password,
      confirmedPassword: password,
      firstName: row.firstName?.trim() || "Auto",
      lastName: row.lastName?.trim() || "User",
      gender: (row.gender?.toUpperCase() as RegisterPayload["gender"]) || "MALE",
      dateOfBirth: row.dateOfBirth || "2000-01-01",
      location: { lat: 10.7, lon: 106.6, source: "CSV" },
    };

    try {
      const res = await registerUser(payload, deviceId);
      const apiRes: ApiRes = res.data;

      if (!apiRes?.isSucceed) {
        const msg = apiRes?.message ?? "Unknown error";
        if (isAlreadyExists(msg)) {
          // tồn tại => im luôn theo yêu cầu
          continue;
        }

        fail++;
        const userId = await findUserIdByPhone(phone);
        await insertAuthStatus({
          action: "REGISTER",
          phone,
          deviceId,
          userId,
          status: 0,
          detail: msg,
          logId,
        });
        await insertUserAction({
          userId,
          actionName: "REGISTER",
          detail: msg,
          logId,
        });
        logger.error(`[REGISTER FAIL] phone=${phone} msg=${msg}`);
        continue;
      }

      // Register OK -> chờ OTP (nếu redis không có thì coi là pending, không tính fail)
      const redisRec = await waitForOtpFromRedis(phone, ENV.OTP_TIMEOUT_MS, ENV.OTP_POLL_MS);
      if (!redisRec?.otp) {
        pending++;
        const userId = await findUserIdByPhone(phone);
        await insertAuthStatus({
          action: "REGISTER",
          phone,
          deviceId,
          userId,
          status: 0,
          detail: "PENDING_OTP",
          logId,
        });
        await insertUserAction({
          userId,
          actionName: "REGISTER",
          detail: "PENDING_OTP",
          logId,
        });
        continue;
      }

      const otp = redisRec.otp;

      const verifyRes = await verifyRegisterOtpApi(phone, otp, deviceId);
      const verifyApi: ApiRes = verifyRes.data;

      if (!verifyApi?.isSucceed) {
        fail++;
        const msg = verifyApi?.message ?? "Verify failed";
        const userId = await findUserIdByPhone(phone);
        await insertAuthStatus({
          action: "REGISTER",
          phone,
          deviceId,
          userId,
          status: 0,
          detail: msg,
          logId,
        });
        await insertUserAction({
          userId,
          actionName: "REGISTER",
          detail: msg,
          logId,
        });
        logger.error(`[REGISTER VERIFY FAIL] phone=${phone} otp=${otp} msg=${msg}`);
        continue;
      }

      // ✅ chỉ log thành công
      success++;
      const userId = await findUserIdByPhone(phone);
      await insertAuthStatus({
        action: "REGISTER",
        phone,
        deviceId,
        userId,
        status: 1,
        detail: `OTP=${otp}`,
        logId,
      });
      await insertUserAction({
        userId,
        actionName: "REGISTER",
        detail: `SUCCESS OTP=${otp}`,
        logId,
      });
      logger.info(`[REGISTER OK] phone=${phone} OTP=${otp}`);
    } catch (err: any) {
      fail++;
      const msg = err?.response?.data?.message || err?.message || String(err);
      const userId = await findUserIdByPhone(phone);
      await insertAuthStatus({
        action: "REGISTER",
        phone,
        deviceId,
        userId,
        status: 0,
        detail: msg,
        logId,
      });
      await insertUserAction({
        userId,
        actionName: "REGISTER",
        detail: msg,
        logId,
      });
      logger.error(`[REGISTER ERROR] phone=${phone} msg=${msg}`);
    }
  }

  return { success, pending, fail };
}
