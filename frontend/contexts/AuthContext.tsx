"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  login as apiLogin,
  register as apiRegister,
  refresh as apiRefresh,
  setAuthCallbacks,
  isTokenExpired,
} from "@/services/api";

interface User {
  userId: number;
  accountId: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (accountId: string, password: string) => Promise<void>;
  register: (accountId: string, password: string, email: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
}

const AUTH_STORAGE_KEY = "strayspotter_auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredAuth(): { token: string; user: User } | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed?.token && parsed?.user) return parsed;
    return null;
  } catch {
    return null;
  }
}

function setStoredAuth(token: string, user: User) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }));
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const stored = getStoredAuth();
      if (!stored) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      if (isTokenExpired(stored.token)) {
        try {
          const newToken = await apiRefresh();
          if (!cancelled && newToken) {
            setToken(newToken);
            setUser(stored.user);
            setStoredAuth(newToken, stored.user);
          } else if (!cancelled) {
            clearStoredAuth();
          }
        } catch {
          if (!cancelled) {
            clearStoredAuth();
          }
        }
      } else {
        setToken(stored.token);
        setUser(stored.user);
      }
      if (!cancelled) setIsLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (accountId: string, password: string) => {
    const res = await apiLogin(accountId, password);
    setToken(res.token);
    setUser(res.user);
    setStoredAuth(res.token, res.user);
  }, []);

  const register = useCallback(
    async (accountId: string, password: string, email: string) => {
      const res = await apiRegister(accountId, password, email);
      setToken(res.token);
      setUser(res.user);
      setStoredAuth(res.token, res.user);
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearStoredAuth();
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const newToken = await apiRefresh();
      setToken(newToken);
      setUser((currentUser) => {
        if (currentUser) setStoredAuth(newToken, currentUser);
        return currentUser;
      });
      return newToken;
    } catch {
      setToken(null);
      setUser(null);
      clearStoredAuth();
      return null;
    }
  }, []);

  useEffect(() => {
    setAuthCallbacks({
      getToken: () => token,
      refreshToken,
      logout,
    });
    return () => setAuthCallbacks(null);
  }, [token, refreshToken, logout]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
