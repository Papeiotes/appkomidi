export class BookingError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "BookingError";
  }
}

export const SERVICE_MINUTES = 15;
export const FLEX_MINUTES = 30;
export const SLOT_MINUTES = 30;
export const CANCEL_CUTOFF_MINUTES = 15;
export const HORIZON_DAYS = 7;
export const SHIFT_HOURS = 6;
export const DEFAULT_OVERFLOW_KG = 75;

export const BRACKETS = ["KG_0_10", "KG_10_20", "KG_20_50", "KG_50_PLUS"] as const;
export type QuantityBracket = (typeof BRACKETS)[number];

export const BIN_TYPES = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;
export type BinType = (typeof BIN_TYPES)[number];

export type ShiftRunStatus = "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "ENDED";
export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED";

export const OFFICE_PERMISSIONS = [
  "bookings.view",
  "bookings.reschedule",
  "bookings.cancel",
  "bookings.question",
  "slots.toggle",
  "stats.view",
] as const;
export type OfficePermission = (typeof OFFICE_PERMISSIONS)[number];

export function kgForBracket(bracket: QuantityBracket, overflowKg = DEFAULT_OVERFLOW_KG): number {
  if (bracket === "KG_0_10") return 10;
  if (bracket === "KG_10_20") return 20;
  if (bracket === "KG_20_50") return 50;
  return overflowKg;
}

/** Booked times sit on a 30-minute grid. */
export function isQuarterHour(date: Date): boolean {
  return date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0 && date.getUTCMinutes() % SLOT_MINUTES === 0;
}

export function shiftEndsAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() + SHIFT_HOURS * 60 * 60 * 1000);
}

export interface CapacityInput {
  shiftStatus: ShiftRunStatus;
  startsAt: Date;
  endsAt: Date;
  scheduledAt: Date;
  now: Date;
  capacityKg: number;
  usedKg: number;
  requestedKg: number;
  slotClosed: boolean;
  horizonDays?: number;
}

export type Decision = { ok: true; remainingAfter: number } | { ok: false; code: string };

export function evaluateCapacity(input: CapacityInput): Decision {
  if (!Number.isInteger(input.requestedKg) || input.requestedKg <= 0) {
    return { ok: false, code: "INVALID_KG" };
  }
  if (!isQuarterHour(input.scheduledAt)) return { ok: false, code: "NOT_ALIGNED" };
  const horizon = input.horizonDays ?? HORIZON_DAYS;
  if (input.scheduledAt.getTime() <= input.now.getTime()) return { ok: false, code: "IN_THE_PAST" };
  if (input.scheduledAt.getTime() > input.now.getTime() + horizon * 24 * 60 * 60_000) {
    return { ok: false, code: "OUTSIDE_HORIZON" };
  }
  if (input.shiftStatus !== "SCHEDULED") return { ok: false, code: "SHIFT_STARTED" };
  const serviceEnd = input.scheduledAt.getTime() + SERVICE_MINUTES * 60_000;
  if (input.scheduledAt < input.startsAt || serviceEnd > input.endsAt.getTime()) {
    return { ok: false, code: "OUTSIDE_SHIFT" };
  }
  if (input.slotClosed) return { ok: false, code: "SLOT_CLOSED" };
  if (input.usedKg + input.requestedKg > input.capacityKg) return { ok: false, code: "TRUCK_FULL" };
  return { ok: true, remainingAfter: input.capacityKg - input.usedKg - input.requestedKg };
}

export function evaluateCancel(input: {
  status: BookingStatus;
  scheduledAt: Date;
  now: Date;
}): { ok: true } | { ok: false; code: string } {
  if (input.status !== "CONFIRMED") return { ok: false, code: "NOT_CANCELLABLE" };
  if (input.now.getTime() >= input.scheduledAt.getTime() - CANCEL_CUTOFF_MINUTES * 60_000) {
    return { ok: false, code: "TOO_LATE" };
  }
  return { ok: true };
}

export function isValidAfm(afm: string): boolean {
  if (!/^\d{9}$/.test(afm) || afm === "000000000") return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(afm[i]) * 2 ** (8 - i);
  let check = sum % 11;
  if (check === 10) check = 0;
  return check === Number(afm[8]);
}

export interface ShiftCapacityView {
  id: string;
  status: ShiftRunStatus;
  startsAt: string;
  endsAt: string;
  capacityKg: number;
  usedKg: number;
  closedSlots: string[];
}

export function createSerialShiftLock(): <T>(key: string, fn: () => Promise<T>) => Promise<T> {
  const tails = new Map<string, Promise<unknown>>();
  return function run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = tails.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    tails.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  };
}

/**
 * Assign a pickup to the first compatible shift that still has kilograms,
 * while those shifts are locked in a stable order (Postgres FOR UPDATE).
 */
export async function assignUnderLock<TBooking>(opts: {
  lockShifts: () => Promise<void>;
  load: () => Promise<ShiftCapacityView[]>;
  insert: (shiftId: string) => Promise<TBooking>;
  scheduledAt: Date;
  now: Date;
  requestedKg: number;
}): Promise<{ ok: true; booking: TBooking; shiftId: string; remainingAfter: number } | { ok: false; code: string }> {
  await opts.lockShifts();
  const shifts = await opts.load();
  if (shifts.length === 0) return { ok: false, code: "NO_SHIFT" };
  let saw = false;
  let lastCode = "NO_SHIFT";
  for (const shift of shifts) {
    saw = true;
    const decision = evaluateCapacity({
      shiftStatus: shift.status,
      startsAt: new Date(shift.startsAt),
      endsAt: new Date(shift.endsAt),
      scheduledAt: opts.scheduledAt,
      now: opts.now,
      capacityKg: shift.capacityKg,
      usedKg: shift.usedKg,
      requestedKg: opts.requestedKg,
      slotClosed: shift.closedSlots.includes(opts.scheduledAt.toISOString()),
    });
    if (!decision.ok) {
      lastCode = decision.code;
      continue;
    }
    const booking = await opts.insert(shift.id);
    return { ok: true, booking, shiftId: shift.id, remainingAfter: decision.remainingAfter };
  }
  return { ok: false, code: saw ? lastCode : "NO_SHIFT" };
}

export function slotInstants(startsAt: Date, endsAt: Date): Date[] {
  const step = SLOT_MINUTES * 60_000;
  const out: Date[] = [];
  const first = Math.ceil(startsAt.getTime() / step) * step;
  for (let t = first; t + SERVICE_MINUTES * 60_000 <= endsAt.getTime(); t += step) {
    out.push(new Date(t));
  }
  return out;
}

export function suggestSlot(bookable: string[], nearbyTimes: string[]): string | null {
  if (bookable.length === 0) return null;
  if (nearbyTimes.length === 0) return bookable[0];
  const mean =
    nearbyTimes.reduce((sum, iso) => sum + new Date(iso).getTime(), 0) / nearbyTimes.length;
  return [...bookable].sort(
    (a, b) => Math.abs(new Date(a).getTime() - mean) - Math.abs(new Date(b).getTime() - mean),
  )[0];
}
