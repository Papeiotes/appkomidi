import AsyncStorage from "@react-native-async-storage/async-storage";
import { translateError, type Locale } from "@vardia/shared";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const TOKEN = "vardia.token";
const LOCALE = "vardia.locale";
const API = "vardia.api";

export const DEFAULT_API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4107";

export type Role = "ADMIN" | "BUSINESS_OWNER" | "DRIVER" | "EMPLOYEE";
export type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  locale: Locale;
  businessId: string | null;
};

type Session = {
  ready: boolean;
  token: string | null;
  user: User | null;
  locale: Locale;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  setLocale: (locale: Locale) => void;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [locale, setLocaleState] = useState<Locale>("el");
  const [apiUrl, setApiUrlState] = useState(DEFAULT_API);

  useEffect(() => {
    (async () => {
      const [storedToken, storedLocale, storedApi] = await Promise.all([
        AsyncStorage.getItem(TOKEN),
        AsyncStorage.getItem(LOCALE),
        AsyncStorage.getItem(API),
      ]);
      if (storedLocale === "el" || storedLocale === "en") setLocaleState(storedLocale);
      if (storedApi) setApiUrlState(storedApi);
      if (storedToken) {
        setToken(storedToken);
        try {
          const response = await fetch(`${storedApi ?? DEFAULT_API}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (response.ok) {
            const body = (await response.json()) as { user: User };
            setUser(body.user);
            setLocaleState(body.user.locale);
          } else {
            await AsyncStorage.removeItem(TOKEN);
            setToken(null);
          }
        } catch {
          setToken(storedToken);
        }
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo<Session>(() => {
    const base = apiUrl.replace(/\/$/, "");
    return {
      ready,
      token,
      user,
      locale,
      apiUrl: base,
      setApiUrl: (url) => {
        const next = url.replace(/\/$/, "");
        setApiUrlState(next);
        void AsyncStorage.setItem(API, next);
      },
      setLocale: (next) => {
        setLocaleState(next);
        void AsyncStorage.setItem(LOCALE, next);
        if (token) {
          void fetch(`${base}/account`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ locale: next }),
          });
        }
      },
      login: async (nextToken, nextUser) => {
        await AsyncStorage.setItem(TOKEN, nextToken);
        setToken(nextToken);
        setUser(nextUser);
        setLocaleState(nextUser.locale);
      },
      logout: async () => {
        await AsyncStorage.removeItem(TOKEN);
        setToken(null);
        setUser(null);
      },
      api: async <T,>(path: string, init: RequestInit = {}) => {
        const headers = new Headers(init.headers);
        if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        if (token) headers.set("Authorization", `Bearer ${token}`);
        let response: Response;
        try {
          response = await fetch(`${base}${path}`, { ...init, headers });
        } catch {
          throw new Error("NETWORK");
        }
        const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
        if (!response.ok) throw new Error(body.error?.code ?? "REQUEST_FAILED");
        return body as T;
      },
    };
  }, [ready, token, user, locale, apiUrl]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const value = useContext(Ctx);
  if (!value) throw new Error("Session missing");
  return value;
}

export function explain(locale: Locale, code: string) {
  return translateError(locale, code);
}
