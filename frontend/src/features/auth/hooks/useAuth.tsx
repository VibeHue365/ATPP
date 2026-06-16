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
  login: (payload: any) => Promise<void>;
  register: (payload: any) => Promise<any>;
  verifyEmail: (payload: any) => Promise<void>;
  resendOtp: (payload: any) => Promise<any>;
  forgotPassword: (payload: any) => Promise<any>;
  resetPassword: (payload: any) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: any) => Promise<void>;
  updateAvatar: (formData: FormData) => Promise<void>;
  setSession: (accessToken: string, refreshToken: string) => Promise<void>;
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

  const fetchProfile = async () => {
    try {
      const profile = await userService.getMe();
      setUser(profile);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error("Failed to load user profile:", err);
      logoutLocal();
    }
  };

  const logoutLocal = () => {
    tokenStorage.clearTokens();
    setUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = tokenStorage.getAccessToken();
      if (token) {
        await fetchProfile();
      }
      setIsLoading(false);
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

  const login = async (payload: any) => {
    setError(null);
    try {
      const { rememberMe = false, ...credentials } = payload;
      const res = await authService.login(credentials);
      if (res.accessToken && res.refreshToken) {
        tokenStorage.saveTokens(res.accessToken, res.refreshToken, rememberMe);
        await fetchProfile();
      } else {
        throw new Error("Tokens missing in login response");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
      throw err;
    }
  };

  const register = async (payload: any) => {
    setError(null);
    try {
      const res = await authService.register(payload);
      return res;
    } catch (err: any) {
      setError(err.message || "Registration failed");
      throw err;
    }
  };

  const verifyEmail = async (payload: any) => {
    setError(null);
    try {
      await authService.verifyEmail(payload);
    } catch (err: any) {
      setError(err.message || "Email verification failed");
      throw err;
    }
  };

  const resendOtp = async (payload: any) => {
    setError(null);
    try {
      return await authService.resendVerification(payload);
    } catch (err: any) {
      setError(err.message || "Resending verification failed");
      throw err;
    }
  };

  const forgotPassword = async (payload: any) => {
    setError(null);
    try {
      return await authService.forgotPassword(payload);
    } catch (err: any) {
      setError(err.message || "Forgot password request failed");
      throw err;
    }
  };

  const resetPassword = async (payload: any) => {
    setError(null);
    try {
      await authService.resetPassword(payload);
    } catch (err: any) {
      setError(err.message || "Reset password failed");
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
      setError(err.message || "Updating profile failed");
      throw err;
    }
  };

  const updateAvatar = async (formData: FormData) => {
    setError(null);
    try {
      const updated = await userService.updateAvatar(formData);
      setUser(updated);
    } catch (err: any) {
      setError(err.message || "Uploading avatar failed");
      throw err;
    }
  };

  const setSession = async (accessToken: string, refreshToken: string) => {
    tokenStorage.saveTokens(accessToken, refreshToken, true);
    setIsLoading(true);
    await fetchProfile();
    setIsLoading(false);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        login,
        register,
        verifyEmail,
        resendOtp,
        forgotPassword,
        resetPassword,
        logout,
        updateProfile,
        updateAvatar,
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
