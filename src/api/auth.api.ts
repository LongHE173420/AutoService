// src/api/auth.api.ts
import axios from "axios";
import { ENV } from "../config/env";
import { buildHeaders } from "../utils/headers";

export type ApiRes<T = any> = {
  isSucceed: boolean;
  message?: string;
  data?: T;
};

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  password: string;
  confirmedPassword: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  location?: { lat: number; lon: number; source: string };
};

function normalizePhone(raw: string) {
  let p = String(raw || "").trim();
  p = p.replace(/\D/g, "");
  return p;
}

// ===== REGISTER =====
export async function registerUser(payload: RegisterPayload, deviceId: string) {
  const body: RegisterPayload = {
    ...payload,
    phone: normalizePhone(payload.phone),
  };

  return axios.post(`${ENV.BASE_URL}/auth/register`, body, {
    headers: buildHeaders(deviceId),
  });
}

export async function verifyRegisterOtpApi(
  phone: string,
  otp: string,
  deviceId: string
) {
  return axios.post(
    `${ENV.BASE_URL}/auth/verify-register-otp`,
    { phone: normalizePhone(phone), otp: String(otp || "").trim() },
    { headers: buildHeaders(deviceId) }
  );
}

export async function resendRegisterOtpApi(phone: string, deviceId: string) {
  return axios.post(
    `${ENV.BASE_URL}/auth/resend-otp-register`,
    { phone: normalizePhone(phone) },
    { headers: buildHeaders(deviceId) }
  );
}

// ===== LOGIN =====
export async function loginApi(phone: string, password: string, deviceId: string) {
  return axios.post(
    `${ENV.BASE_URL}/auth/login`,
    { phone: normalizePhone(phone), password: String(password || "").trim() },
    { headers: buildHeaders(deviceId) }
  );
}

export async function verifyLoginOtpApi(
  phone: string,
  otp: string,
  deviceId: string
) {
  return axios.post(
    `${ENV.BASE_URL}/auth/verify-login-otp`,
    { phone: normalizePhone(phone), otp: String(otp || "").trim() },
    { headers: buildHeaders(deviceId) }
  );
}

export async function resendLoginOtpApi(phone: string, deviceId: string) {
  return axios.post(
    `${ENV.BASE_URL}/auth/resend-otp-login`,
    { phone: normalizePhone(phone) },
    { headers: buildHeaders(deviceId) }
  );
}
