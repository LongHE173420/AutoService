import axios from "axios";
import { buildHeaders } from "../utils/headers";

const BASE_URL = "http://localhost:3000";

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
  location?: {
    lat: number;
    lon: number;
    source: string;
  };
};
export async function registerUser(user: RegisterPayload, deviceId: string) {
  const phone = String(user.phone || "").replace(/\D/g, "");

  return axios.post<ApiRes<{ otpSample?: string }>>(
    `${BASE_URL}/auth/register`,
    {
      phone,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      location: user.location,
    },
    {
      headers: buildHeaders(deviceId),
    }
  );
}

export async function verifyRegisterOtpApi(
  phone: string,
  otp: string,
  deviceId: string
) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "");

  return axios.post<ApiRes>(
    `${BASE_URL}/auth/verify-register-otp`,
    {
      phone: normalizedPhone,
      otp,
    },
    {
      headers: buildHeaders(deviceId),
    }
  );
}

export async function loginApi(
  phone: string,
  password: string,
  deviceId: string
) {
  const username = String(phone || "").replace(/\D/g, "");

  return axios.post<ApiRes<{ needOtp: boolean; tokens?: any; otpSample?: string }>>(
    `${BASE_URL}/auth/login`,
    { username, password },
    {
      headers: buildHeaders(deviceId),
    }
  );
}
export async function verifyLoginOtpApi(
  phone: string,
  otp: string,
  deviceId: string
) {
  const username = String(phone || "").replace(/\D/g, "");

  return axios.post<ApiRes<{ tokens: any }>>(
    `${BASE_URL}/auth/verify-login-otp`,
    { username, otp },
    {
      headers: buildHeaders(deviceId),
    }
  );
}
