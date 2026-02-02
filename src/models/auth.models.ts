
export type ApiRes<T = unknown> = {
  isSucceed: boolean;
  message?: string;
  data?: T;
};

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  accessExp: number;
  refreshExp: number;
  trust: boolean;
};


export type LoginResult = {
  needOtp: boolean;
  otpSample?: string;
  tokens?: Tokens;
};


export type VerifyLoginOtpResult = {
  tokens: Tokens;
};

export type ResendLoginOtpResult = {
  otpSample: string;
  phase: string;
};

export type ValidatePhoneResult = null;

export type RegisterDraftResult = null;

export type VerifyRegisterOtpResult = null;

export type ResendRegisterOtpResult = null;
