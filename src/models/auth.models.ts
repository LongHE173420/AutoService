// src/models/auth.models.ts

// Response chuẩn từ server
export type ApiRes<T = unknown> = {
  isSucceed: boolean;
  message?: string;
  data?: T;
};

// Cặp token giống bên auth-service
export type Tokens = {
  accessToken: string;
  refreshToken: string;
  accessExp: number;
  refreshExp: number;
  trust: boolean;
};

// Kết quả login
export type LoginResult = {
  needOtp: boolean;
  otpSample?: string;
  tokens?: Tokens;
};

// Verify login OTP
export type VerifyLoginOtpResult = {
  tokens: Tokens;
};

// Resend login OTP
export type ResendLoginOtpResult = {
  otpSample: string;
  phase: string;
};

// Validate phone khi đăng ký
export type ValidatePhoneResult = null;

// Đăng ký draft
export type RegisterDraftResult = null;

// Verify register OTP
export type VerifyRegisterOtpResult = null;

// Resend register OTP
export type ResendRegisterOtpResult = null;
