export const MAX_SEATS_PER_BOOKING = 4;
export const DEFAULT_LOCK_MINUTES = 30;
export const MAX_SHIFT_CAPACITY = 60;

export type ShiftStatus =
  | "DRAFT"
  | "OPEN"
  | "LOCKED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export class BookingError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "BookingError";
  }
}

export interface BookingDecisionInput {
  shiftStatus: ShiftStatus;
  capacity: number;
  confirmedSeats: number;
  alreadyBooked: boolean;
  requestedSeats: number;
  now: Date;
  departsAt: Date;
  lockMinutes: number;
  maxSeatsPerBooking?: number;
}

export type Decision = { ok: true; remainingAfter: number } | { ok: false; code: string };

export function remainingSeats(capacity: number, confirmedSeats: number): number {
  return Math.max(0, capacity - confirmedSeats);
}

/** Bookings close this many minutes before departure, even if the row still says OPEN. */
export function isLockedByTime(now: Date, departsAt: Date, lockMinutes: number): boolean {
  return now.getTime() >= departsAt.getTime() - lockMinutes * 60_000;
}

export function evaluateBooking(input: BookingDecisionInput): Decision {
  const max = input.maxSeatsPerBooking ?? MAX_SEATS_PER_BOOKING;
  if (!Number.isInteger(input.requestedSeats) || input.requestedSeats < 1) {
    return { ok: false, code: "INVALID_SEATS" };
  }
  if (input.requestedSeats > max) {
    return { ok: false, code: "TOO_MANY_SEATS" };
  }
  if (input.shiftStatus === "LOCKED" || isLockedByTime(input.now, input.departsAt, input.lockMinutes)) {
    return { ok: false, code: "SHIFT_LOCKED" };
  }
  if (input.shiftStatus !== "OPEN") {
    return { ok: false, code: "SHIFT_NOT_OPEN" };
  }
  if (input.alreadyBooked) {
    return { ok: false, code: "ALREADY_BOOKED" };
  }
  const remaining = remainingSeats(input.capacity, input.confirmedSeats);
  if (input.requestedSeats > remaining) {
    return { ok: false, code: "SHIFT_FULL" };
  }
  return { ok: true, remainingAfter: remaining - input.requestedSeats };
}

export function evaluateCancel(input: {
  bookingStatus: BookingStatus | null;
  shiftStatus: ShiftStatus;
  now: Date;
  departsAt: Date;
  lockMinutes: number;
}): { ok: true } | { ok: false; code: string } {
  if (input.bookingStatus !== "CONFIRMED") {
    return { ok: false, code: "NOT_CANCELLABLE" };
  }
  if (input.shiftStatus === "IN_PROGRESS" || input.shiftStatus === "COMPLETED" || input.shiftStatus === "CANCELLED") {
    return { ok: false, code: "SHIFT_NOT_CANCELLABLE" };
  }
  if (input.shiftStatus === "LOCKED" || isLockedByTime(input.now, input.departsAt, input.lockMinutes)) {
    return { ok: false, code: "SHIFT_LOCKED" };
  }
  return { ok: true };
}

export function evaluateStart(status: ShiftStatus): { ok: true } | { ok: false; code: string } {
  if (status === "OPEN" || status === "LOCKED") return { ok: true };
  if (status === "IN_PROGRESS") return { ok: false, code: "ALREADY_STARTED" };
  return { ok: false, code: "CANNOT_START" };
}

export function evaluateComplete(status: ShiftStatus): { ok: true } | { ok: false; code: string } {
  if (status === "IN_PROGRESS") return { ok: true };
  return { ok: false, code: "CANNOT_COMPLETE" };
}

export function assertShiftCapacity(
  capacity: number,
  vehicleSeats: number | null,
): { ok: true } | { ok: false; code: "INVALID_CAPACITY" | "VEHICLE_TOO_SMALL" } {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_SHIFT_CAPACITY) {
    return { ok: false, code: "INVALID_CAPACITY" };
  }
  if (vehicleSeats != null && capacity > vehicleSeats) {
    return { ok: false, code: "VEHICLE_TOO_SMALL" };
  }
  return { ok: true };
}

export interface LockedShiftView {
  id: string;
  status: ShiftStatus;
  capacity: number;
  confirmedSeats: number;
  passengerIds: string[];
  departsAt: string;
  lockMinutes: number;
}

/**
 * The decision step that runs while a shift row is locked.
 * Callers must serialize `lockShift` per shift (Postgres `SELECT … FOR UPDATE`,
 * or `createSerialShiftLock` in-process) and `load` must observe bookings
 * committed by the previous holder of that lock.
 */
export async function bookInTransaction<TBooking>(opts: {
  lockShift: () => Promise<void>;
  load: () => Promise<LockedShiftView | null>;
  insert: (seats: number) => Promise<TBooking>;
  requestedSeats: number;
  userId: string;
  now: Date;
}): Promise<{ ok: true; booking: TBooking; remainingAfter: number } | { ok: false; code: string }> {
  await opts.lockShift();
  const shift = await opts.load();
  if (!shift) return { ok: false, code: "SHIFT_NOT_FOUND" };
  const decision = evaluateBooking({
    shiftStatus: shift.status,
    capacity: shift.capacity,
    confirmedSeats: shift.confirmedSeats,
    alreadyBooked: shift.passengerIds.includes(opts.userId),
    requestedSeats: opts.requestedSeats,
    now: opts.now,
    departsAt: new Date(shift.departsAt),
    lockMinutes: shift.lockMinutes,
  });
  if (!decision.ok) return decision;
  const booking = await opts.insert(opts.requestedSeats);
  return { ok: true, booking, remainingAfter: decision.remainingAfter };
}

export async function cancelInTransaction<TBooking>(opts: {
  lockShift: () => Promise<void>;
  load: () => Promise<{
    shiftStatus: ShiftStatus;
    departsAt: string;
    lockMinutes: number;
    bookingStatus: BookingStatus | null;
  } | null>;
  cancel: () => Promise<TBooking>;
  now: Date;
}): Promise<{ ok: true; booking: TBooking } | { ok: false; code: string }> {
  await opts.lockShift();
  const row = await opts.load();
  if (!row) return { ok: false, code: "BOOKING_NOT_FOUND" };
  const decision = evaluateCancel({
    bookingStatus: row.bookingStatus,
    shiftStatus: row.shiftStatus,
    now: opts.now,
    departsAt: new Date(row.departsAt),
    lockMinutes: row.lockMinutes,
  });
  if (!decision.ok) return decision;
  const booking = await opts.cancel();
  return { ok: true, booking };
}

/** In-process stand-in for a row lock: one shift, one runner at a time. */
export function createSerialShiftLock(): <T>(shiftId: string, fn: () => Promise<T>) => Promise<T> {
  const tails = new Map<string, Promise<unknown>>();
  return function run<T>(shiftId: string, fn: () => Promise<T>): Promise<T> {
    const prev = tails.get(shiftId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    tails.set(
      shiftId,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  };
}
