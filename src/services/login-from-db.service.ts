import { mysqlPool } from "../config/database";
import { ENV } from "../config/env";
import { insertAuthStatus, insertUserAction } from "../repo/audit.repo";
import { loginApi, type ApiRes } from "../api/auth.api";

type DbUser = {
  id: number;
  phone: string;
  password: string;
  deviceId: string;
};

function normalizePhone(raw: string) {
  return String(raw || "").replace(/\D/g, "");
}

export async function loginFromDb(opts: {
  logId: number;
  logger: any;
}) {
  const { logId, logger } = opts;

  const conn = await mysqlPool.getConnection();
  let users: DbUser[] = [];

  try {
    const [rows] = await conn.query(
      `
      SELECT u.id, u.phone, u.password, u.deviceId
      FROM users u
      LEFT JOIN (
        SELECT phone, MAX(createdAt) as lastLogin
        FROM auth_status
        WHERE action='LOGIN' AND status=1
        GROUP BY phone
      ) t ON t.phone = u.phone
      WHERE t.lastLogin IS NULL OR t.lastLogin < (NOW() - INTERVAL ? MINUTE)
      ORDER BY u.id DESC
      LIMIT ?
      `,
      [ENV.LOGIN_COOLDOWN_MIN, ENV.LOGIN_LIMIT]
    ) as any;

    users = (rows || []) as DbUser[];
  } finally {
    conn.release();
  }

  if (!users.length) {
    logger.info("no users to login by cooldown filter");
    return { success: 0, pending: 0, fail: 0 };
  }

  let success = 0;
  let pending = 0;
  let fail = 0;

  for (const u of users) {
    const phone = normalizePhone(u.phone);
    const password = String(u.password || "");
    const deviceId = String(u.deviceId || "");

    if (!phone || !password || !deviceId) {
      logger.warn({ userId: u.id, phone }, "skip user missing phone/password/deviceId");
      continue;
    }

    try {
      const res = await loginApi(phone, password, deviceId);
      const apiRes: ApiRes = res.data;

      if (!apiRes?.isSucceed) {
        const msg = apiRes?.message || "LOGIN_FAIL";
        logger.warn({ userId: u.id, phone, msg }, "login failed");

        await insertUserAction({
          userId: u.id,
          actionName: "LOGIN_FAIL",
          detail: msg,
          logId
        });

        await insertAuthStatus({
          action: "LOGIN",
          phone,
          deviceId,
          userId: u.id,
          status: 0,
          detail: msg,
          logId
        });

        fail++;
        continue;
      }

      // tùy server trả data.needOtp
      const needOtp = Boolean((apiRes as any)?.data?.needOtp);

      if (needOtp) {
        logger.info({ userId: u.id, phone }, "login pending otp");
        await insertUserAction({
          userId: u.id,
          actionName: "LOGIN_PENDING_OTP",
          detail: apiRes?.message || "WAIT_OTP",
          logId
        });
        pending++;
        continue;
      }

      logger.info({ userId: u.id, phone }, "login success");

      await insertUserAction({
        userId: u.id,
        actionName: "LOGIN_SUCCESS",
        detail: "OK",
        logId
      });

      await insertAuthStatus({
        action: "LOGIN",
        phone,
        deviceId,
        userId: u.id,
        status: 1,
        detail: "OK",
        logId
      });

      // console chỉ in success
      console.log(`✅ LOGIN SUCCESS: ${phone} (userId=${u.id})`);
      success++;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || String(err);
      logger.error({ userId: u.id, phone, msg }, "login exception");

      await insertUserAction({
        userId: u.id,
        actionName: "LOGIN_EXCEPTION",
        detail: msg,
        logId
      });

      await insertAuthStatus({
        action: "LOGIN",
        phone,
        deviceId,
        userId: u.id,
        status: 0,
        detail: msg,
        logId
      });

      fail++;
    }
  }
  return { success, pending, fail };
}
