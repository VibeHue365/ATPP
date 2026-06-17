import { httpClient } from "../../../services/httpClient";
import type {
  ForgotPasswordResponse,
  LoginResponse,
  MessageResponse,
  RegisterResponse,
  VerifyEmailResponse,
} from "../types/auth.types";

export const authService = {
  async register(payload: any): Promise<RegisterResponse> {
    return httpClient.post<RegisterResponse>("/auth/register", payload);
  },

  async verifyEmail(payload: any): Promise<VerifyEmailResponse> {
    return httpClient.post<VerifyEmailResponse>("/auth/verify-email", payload);
  },

  async resendVerification(payload: any): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>(
      "/auth/resend-verification",
      payload,
    );
  },

  async login(payload: any): Promise<LoginResponse> {
    return httpClient.post<LoginResponse>("/auth/login", payload);
  },

  async logout(): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>("/auth/logout");
  },

  async changePassword(payload: any): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>("/auth/change-password", payload);
  },

  async forgotPassword(payload: any): Promise<ForgotPasswordResponse> {
    return httpClient.post<ForgotPasswordResponse>(
      "/auth/forgot-password",
      payload,
    );
  },

  async resetPassword(payload: any): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>("/auth/reset-password", payload);
  },
};
