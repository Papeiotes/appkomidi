import type { Locale } from "@vardia/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4107";

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

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

export type LatLngLabel = { lat: number; lng: number; label: string };

export type Shift = {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  direction: "TO_WORK" | "FROM_WORK";
  departsAt: string;
  capacity: number;
  lockMinutes: number;
  status: "DRAFT" | "OPEN" | "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  muster: LatLngLabel;
  destination: LatLngLabel;
  driver: { id: string; name: string; email: string; phone: string | null } | null;
  vehicle: { id: string; plate: string; label: string | null; seats: number } | null;
  confirmedSeats: number;
  remainingSeats: number;
  bookable: boolean;
  location: { lat: number; lng: number; heading: number | null; speed: number | null; recordedAt: string | null } | null;
  myBooking?: { id: string; seats: number; pickup: LatLngLabel } | null;
};

export type BookingRow = {
  id: string;
  seats: number;
  status: string;
  pickup: LatLngLabel;
  rider?: { id: string; name: string; phone?: string | null; email?: string };
  createdAt?: string;
  shift?: Shift;
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
  if (role === "BUSINESS_OWNER") return "/business";
  if (role === "DRIVER") return "/drive";
  return "/ride";
}
