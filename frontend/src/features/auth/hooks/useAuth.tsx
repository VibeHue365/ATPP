import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService";
import { userService } from "../../users/services/userService";
import type { UserProfile } from "../../users/types/users.types";
import { tokenStorage } from "../../../services/tokenStorage";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<string[]>;
  login: (payload: any) => Promise<UserProfile>;
  register: (payload: any) => Promise<any>;
  verifyEmail: (payload: any) => Promise<void>;
  resendOtp: (payload: any) => Promise<any>;
  forgotPassword: (payload: any) => Promise<any>;
  resetPassword: (payload: any) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: any) => Promise<void>;
  updateAvatar: (formData: FormData) => Promise<void>;
  updatePreferences: (payload: any) => Promise<void>;
  toggleFavorite: (targetType: 'PRODUCT' | 'PHOTOGRAPHER' | 'PROVIDER', targetId: string) => Promise<void>;  setSession: (accessToken: string, refreshToken: string) => Promise<UserProfile>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const refreshPermissions = async (): Promise<string[]> => {
    const access = await authService.getPermissions();
    const nextPermissions = access.permissions || [];
    setPermissions(nextPermissions);
    return nextPermissions;
  };

  const fetchProfile = async (): Promise<UserProfile> => {
    try {
      const [profile, access] = await Promise.all([
        userService.getMe(),
        authService.getPermissions(),
      ]);
      setUser(profile);
      setPermissions(access.permissions || []);
      setIsAuthenticated(true);
      return profile;
    } catch (err: any) {
      console.error("Failed to load user profile:", err);
      logoutLocal();
      throw err;
    }
  };

  const logoutLocal = () => {
    tokenStorage.clearTokens();
    setUser(null);
    setPermissions([]);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = tokenStorage.getAccessToken();
        if (token) {
          await fetchProfile();
        }
      } catch (err) {
        console.error("Init auth failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen to global logout events from httpClient
    const handleGlobalLogout = () => {
      logoutLocal();
    };

    window.addEventListener("auth-logout", handleGlobalLogout);
    return () => {
      window.removeEventListener("auth-logout", handleGlobalLogout);
    };
  }, []);

  const login = async (payload: any): Promise<UserProfile> => {
    setError(null);
    try {
      const { rememberMe = false, ...credentials } = payload;
      const res = await authService.login(credentials);
      if (res.accessToken && res.refreshToken) {
        tokenStorage.saveTokens(res.accessToken, res.refreshToken, rememberMe);
        return await fetchProfile();
      } else {
        throw new Error("Tokens missing in login response");
      }
    } catch (err: any) {
      setError(err.message || "Đăng nhập thất bại");
      throw err;
    }
  };

  const register = async (payload: any) => {
    setError(null);
    try {
      const res = await authService.register(payload);
      return res;
    } catch (err: any) {
      setError(err.message || "Đăng ký thất bại");
      throw err;
    }
  };

  const verifyEmail = async (payload: any) => {
    setError(null);
    try {
      await authService.verifyEmail(payload);
    } catch (err: any) {
      setError(err.message || "Xác minh email thất bại");
      throw err;
    }
  };

  const resendOtp = async (payload: any) => {
    setError(null);
    try {
      return await authService.resendVerification(payload);
    } catch (err: any) {
      setError(err.message || "Gửi lại mã xác minh thất bại");
      throw err;
    }
  };

  const forgotPassword = async (payload: any) => {
    setError(null);
    try {
      return await authService.forgotPassword(payload);
    } catch (err: any) {
      setError(err.message || "Gửi yêu cầu quên mật khẩu thất bại");
      throw err;
    }
  };

  const resetPassword = async (payload: any) => {
    setError(null);
    try {
      await authService.resetPassword(payload);
    } catch (err: any) {
      setError(err.message || "Đặt lại mật khẩu thất bại");
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await authService.logout().catch(() => {});
    } finally {
      logoutLocal();
    }
  };

  const updateProfile = async (payload: any) => {
    setError(null);
    try {
      const updated = await userService.updateProfile(payload);
      setUser(updated);
    } catch (err: any) {
      setError(err.message || "Cập nhật hồ sơ thất bại");
      throw err;
    }
  };

  const updateAvatar = async (formData: FormData) => {
    setError(null);
    try {
      const updated = await userService.updateAvatar(formData);
      setUser(updated);
    } catch (err: any) {
      setError(err.message || "Tải ảnh đại diện thất bại");
      throw err;
    }
  };

  const updatePreferences = async (payload: any) => {
    setError(null);
    try {
      const updated = await userService.updatePreferences(payload);
      setUser(updated);
    } catch (err: any) {
      setError(err.message || "Cập nhật tùy chọn thất bại");
      throw err;
    }
  };

  const toggleFavorite = async (targetType: 'PRODUCT' | 'PHOTOGRAPHER' | 'PROVIDER', targetId: string) => {
    setError(null);
    try {
      const updated = await userService.toggleFavorite(targetType, targetId);
      setUser(updated);
    } catch (err: any) {
      setError(err.message || "Cập nhật mục yêu thích thất bại");
      throw err;
    }
  };

  const setSession = async (
    accessToken: string,
    refreshToken: string,
  ): Promise<UserProfile> => {
    tokenStorage.saveTokens(accessToken, refreshToken, true);
    setIsLoading(true);
    try {
      return await fetchProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);
  const hasPermission = (permission: string) => permissions.includes(permission);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        permissions,
        hasPermission,
        refreshPermissions,
        login,
        register,
        verifyEmail,
        resendOtp,
        forgotPassword,
        resetPassword,
        logout,
        updateProfile,
        updateAvatar,
        updatePreferences,
        toggleFavorite,
        setSession,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
