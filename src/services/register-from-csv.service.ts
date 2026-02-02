import fs from "fs";
import { parse } from "csv-parse/sync";
import { generateDeviceId } from "../utils/device";
import {
  registerUser,
  verifyRegisterOtpApi,
  type RegisterPayload,
  type ApiRes,
} from "../api/auth.api";

type CsvRow = {
  phone: string;
  password: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
};

function isAlreadyExistsMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("đã tồn tại") ||
    lower.includes("tồn tại") ||
    lower.includes("already exists") ||
    lower.includes("exist")
  );
}

export async function registerFromCsv(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.warn("⚠️ Không tìm thấy CSV:", filePath);
    return;
  }

  const content = fs.readFileSync(filePath);
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  if (!Array.isArray(records) || records.length === 0) {
    console.log("⚠️ CSV trống hoặc không có bản ghi hợp lệ");
    return;
  }

  const successUsers: {
    phone: string;
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
  }[] = [];

  const failedRows: { phone: string; reason: string }[] = [];

  for (const row of records) {
    const phone = String(row.phone || "").trim();
    const password = String(row.password || "").trim();

    if (!phone || !password) {
      console.warn("⚠️ Bỏ qua dòng CSV vì thiếu phone/password:", row);
      failedRows.push({
        phone: phone || row.phone || "<empty>",
        reason: "Thiếu phone/password trong CSV",
      });
      continue;
    }

    const deviceId = generateDeviceId();

    const payload: RegisterPayload = {
      phone,
      password,
      confirmedPassword: password,
      firstName: row.firstName?.trim() || "Auto",
      lastName: row.lastName?.trim() || "User",
      gender:
        (row.gender?.toUpperCase() as RegisterPayload["gender"]) || "MALE",
      dateOfBirth: row.dateOfBirth || "2000-01-01",
      location: {
        lat: 10.7,
        lon: 106.6,
        source: "CSV",
      },
    };

    try {
      console.log(
        `▶ Registering: ${payload.phone} | device: ${deviceId} | name: ${payload.firstName} ${payload.lastName}`
      );

      const res = await registerUser(payload, deviceId);
      const apiRes: ApiRes = res.data;

      if (!apiRes?.isSucceed) {
        if (isAlreadyExistsMessage(apiRes.message)) {
          continue;
        }

        const reason = apiRes?.message ?? "Unknown error";
        console.error(`❌ Register FAILED ${payload.phone}:`, reason);
        failedRows.push({ phone: payload.phone, reason });
        continue;
      }

      let otp: string | undefined;
      if (typeof apiRes.message === "string") {
        const match = apiRes.message.match(/(\d{6})/);
        if (match) otp = match[1];
      }

      if (!otp) {
        const reason = `Register OK nhưng không tìm thấy OTP mẫu trong message cho ${payload.phone}`;
        console.warn("⚠️", reason);
        failedRows.push({ phone: payload.phone, reason });
        continue;
      }

      console.log(`   📩 OTP sample for ${payload.phone}: ${otp}`);

      const verifyRes = await verifyRegisterOtpApi(
        payload.phone,
        otp,
        deviceId
      );
      const verifyApi: ApiRes = verifyRes.data;

      if (!verifyApi?.isSucceed) {
        const reason = verifyApi?.message ?? "Unknown error";
        console.error(
          `❌ Verify OTP FAILED ${payload.phone}:`,
          reason
        );
        failedRows.push({ phone: payload.phone, reason });
        continue;
      }

      console.log(
        `✅ ĐĂNG KÝ THÀNH CÔNG: ${payload.phone} | ${payload.firstName} ${payload.lastName} | ${payload.gender} | ${payload.dateOfBirth}`
      );

      successUsers.push({
        phone: payload.phone,
        firstName: payload.firstName,
        lastName: payload.lastName,
        gender: payload.gender,
        dateOfBirth: payload.dateOfBirth,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        String(err);

      if (isAlreadyExistsMessage(msg)) {
        continue;
      }

      console.error(`❌ ERROR xử lý ${row.phone}:`, msg);
      failedRows.push({ phone, reason: msg });
    }
  }

  console.log("\n===== TỔNG KẾT CSV =====");
  console.log(`✅ Đăng ký mới thành công : ${successUsers.length}`);
  if (successUsers.length) {
    for (const u of successUsers) {
      console.log(
        `   + ${u.phone} | ${u.firstName} ${u.lastName} | ${u.gender} | ${u.dateOfBirth}`
      );
    }
  }

  console.log(`❌ Lỗi khác               : ${failedRows.length}`);
  if (failedRows.length) {
    for (const f of failedRows) {
      console.log(`   - ${f.phone}: ${f.reason}`);
    }
  }

  console.log("===== HẾT =====\n");
}
