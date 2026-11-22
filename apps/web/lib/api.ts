import type { Locale } from "@vardia/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4107";

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export type Role = "ADMIN" | "OFFICE" | "DRIVER" | "BUSINESS";
export type BinType = "GREEN" | "BLUE" | "YELLOW" | "BROWN";

export type User = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  role: Role;
  locale: Locale;
  municipalityId: string;
  permissions: string[];
  businessId: string | null;
};

export async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("NETWORK");
  }
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
  if (!response.ok) throw new ApiError(body.error?.code ?? "REQUEST_FAILED");
  return body as T;
}

export function homeFor(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "OFFICE") return "/office";
  if (role === "DRIVER") return "/drive";
  return "/business";
}
