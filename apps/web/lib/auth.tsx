"use client";

import type { Locale } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, homeFor, type Role, type User } from "./api";

const TOKEN_KEY = "vardia.token";
const LOCALE_KEY = "vardia.locale";

type AuthState = {
  ready: boolean;
  token: string | null;
  user: User | null;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [locale, setLocaleState] = useState<Locale>("el");

  useEffect(() => {
    const storedLocale = localStorage.getItem(LOCALE_KEY);
    if (storedLocale === "en" || storedLocale === "el") setLocaleState(storedLocale);
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setReady(true);
      return;
    }
    setToken(stored);
    api<{ user: User }>("/auth/me", {}, stored)
      .then((body) => {
        setUser(body.user);
        setLocaleState(body.user.locale);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "el" ? "el" : "en";
  }, [locale]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      token,
      user,
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        localStorage.setItem(LOCALE_KEY, next);
        if (token) {
          api("/account", { method: "PATCH", body: JSON.stringify({ locale: next }) }, token).catch(() => undefined);
        }
      },
      login: (nextToken, nextUser) => {
        localStorage.setItem(TOKEN_KEY, nextToken);
        setToken(nextToken);
        setUser(nextUser);
        setLocaleState(nextUser.locale);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
      refresh: async () => {
        if (!token) return;
        const body = await api<{ user: User }>("/auth/me", {}, token);
        setUser(body.user);
      },
    }),
    [ready, token, user, locale],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}

export function useRequire(role?: Role) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.ready) return;
    if (!auth.user) router.replace("/login");
    else if (role && auth.user.role !== role) router.replace(homeFor(auth.user.role));
  }, [auth.ready, auth.user, role, router]);
  return auth;
}
