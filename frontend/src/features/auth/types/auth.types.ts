export interface User {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  avatar?: string;
  isEmailVerified: boolean;
  roles?: string[];
  createdAt: string;
}

export interface RegisterResponse {
  message: string;
  demoOtp?: string;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user?: User;
}

export interface ForgotPasswordResponse {
  message: string;
  demoResetToken?: string;
}

export interface MessageResponse {
  message: string;
}
