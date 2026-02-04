// src/services/register-from-csv.service.ts
import fs from "fs";
import { parse } from "csv-parse/sync";
import { generateDeviceId } from "../utils/device";
import { ENV } from "../config/env";
import {
    registerUser,
    verifyRegisterOtpApi,
    type RegisterPayload,
    type ApiRes,
} from "../api/auth.api";
import { waitForOtpFromRedis } from "./otp-redis.service";
import {
    findUserIdByPhone,
    insertAuthStatus,
    insertUserAction,
} from "../repo/audit.repo";

// ✅ Logger type tối giản: chỉ cần .info/.error
export type AppLogger = {
    info: (obj: any, msg?: string) => void;
    error: (obj: any, msg?: string) => void;
    child?: (obj: any) => AppLogger;
};

export type WorkerCtx = {
    logId: number;
    logger: AppLogger;
};

type CsvRow = {
    phone: string;
    password: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    dateOfBirth?: string;
};

function isAlreadyExists(msg: string) {
    const m = String(msg || "").toLowerCase();
    return m.includes("đã tồn tại") || m.includes("tồn tại");
}

async function safeFindUserIdByPhone(phone: string): Promise<number | null> {
    try {
        const id = await findUserIdByPhone(phone);
        return typeof id === "number" ? id : null;
    } catch {
        return null;
    }
}

function pickGender(g?: string): RegisterPayload["gender"] {
    const x = String(g || "").trim().toUpperCase();
    if (x === "MALE" || x === "FEMALE" || x === "OTHER") return x;
    return "MALE";
}

export async function registerFromCsv(filePath: string, ctx: WorkerCtx) {
    const { logId, logger } = ctx;

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

    const otpTimeout = Number(ENV.OTP_TIMEOUT_MS ?? 60_000);
    const otpPoll = Number(ENV.OTP_POLL_MS ?? 2_000);

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
            gender: pickGender(row.gender),
            dateOfBirth: row.dateOfBirth || "2000-01-01",
            location: { lat: 10.7, lon: 106.6, source: "CSV" },
        };

        try {
            const res = await registerUser(payload, deviceId);
            const apiRes: ApiRes = res.data;

            if (!apiRes?.isSucceed) {
                const msg = apiRes?.message ?? "Unknown error";

                // ✅ "đã tồn tại" => bỏ qua hoàn toàn
                if (isAlreadyExists(msg)) {
                    console.log(`[SKIP] Phone ${phone} already exists`);
                    continue;
                }

                fail++;
                console.log(`[FAIL] Phone ${phone} failed to register: ${msg}`);

                const userId = await safeFindUserIdByPhone(phone);

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

                // ✅ ghi lỗi vào FILE
                logger.error({ phone, deviceId, err: msg }, "REGISTER_FAIL");
                continue;
            }

            // Register OK -> chờ OTP (pending nếu không có)
            const redisRec = await waitForOtpFromRedis(phone, otpTimeout, otpPoll);

            if (!redisRec?.otp) {
                // ✅ pending không phải fail => không insert auth_status
                pending++;

                const userId = await safeFindUserIdByPhone(phone);

                await insertUserAction({
                    userId,
                    actionName: "REGISTER",
                    detail: "PENDING_OTP",
                    logId,
                });

                logger.info({ phone, deviceId }, "REGISTER_PENDING_OTP");
                continue;
            }

            const otp = String(redisRec.otp);

            const verifyRes = await verifyRegisterOtpApi(phone, otp, deviceId);
            const verifyApi: ApiRes = verifyRes.data;

            if (!verifyApi?.isSucceed) {
                fail++;
                const msg = verifyApi?.message ?? "Verify failed";
                console.log(`[FAIL] Phone ${phone} verify failed: ${msg}`);
                const userId = await safeFindUserIdByPhone(phone);

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

                logger.error({ phone, deviceId, otp, err: msg }, "REGISTER_VERIFY_FAIL");
                continue;
            }

            // ✅ Success
            success++;

            const userId = await safeFindUserIdByPhone(phone);

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

            logger.info({ phone, deviceId, otp }, "REGISTER_OK");
        } catch (err: any) {
            fail++;

            const msg =
                err?.message ||
                String(err);

            console.log(`[FAIL] Exception for ${phone}: ${msg}`);

            const userId = await safeFindUserIdByPhone(phone);

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

            logger.error({ phone, deviceId, err: msg }, "REGISTER_EXCEPTION");
        }
    }

    return { success, pending, fail };
}
