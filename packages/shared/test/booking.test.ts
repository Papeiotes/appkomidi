import { describe, expect, it } from "vitest";
import {
  bookInTransaction,
  cancelInTransaction,
  createSerialShiftLock,
  evaluateBooking,
  evaluateCancel,
  evaluateComplete,
  evaluateStart,
  assertShiftCapacity,
  type LockedShiftView,
} from "../src/booking";

const departsAt = new Date("2026-11-22T08:00:00.000Z");
const early = new Date("2026-11-22T06:00:00.000Z");
const insideLock = new Date("2026-11-22T07:40:00.000Z");

function booking(overrides: Partial<Parameters<typeof evaluateBooking>[0]> = {}) {
  return evaluateBooking({
    shiftStatus: "OPEN",
    capacity: 2,
    confirmedSeats: 0,
    alreadyBooked: false,
    requestedSeats: 1,
    now: early,
    departsAt,
    lockMinutes: 30,
    ...overrides,
  });
}

describe("evaluateBooking", () => {
  it("accepts a seat and reports what remains", () => {
    expect(booking()).toEqual({ ok: true, remainingAfter: 1 });
  });

  it("accepts the last seat exactly", () => {
    expect(booking({ capacity: 2, confirmedSeats: 1, requestedSeats: 1 })).toEqual({
      ok: true,
      remainingAfter: 0,
    });
  });

  it("refuses one seat over capacity", () => {
    expect(booking({ capacity: 2, confirmedSeats: 2 })).toEqual({ ok: false, code: "SHIFT_FULL" });
    expect(booking({ capacity: 2, confirmedSeats: 1, requestedSeats: 2 })).toEqual({
      ok: false,
      code: "SHIFT_FULL",
    });
  });

  it("refuses a second active booking for the same person", () => {
    expect(booking({ alreadyBooked: true })).toEqual({ ok: false, code: "ALREADY_BOOKED" });
  });

  it("locks by status and by the cutoff clock", () => {
    expect(booking({ shiftStatus: "LOCKED" })).toEqual({ ok: false, code: "SHIFT_LOCKED" });
    expect(booking({ now: insideLock })).toEqual({ ok: false, code: "SHIFT_LOCKED" });
  });

  it("refuses drafts and live routes", () => {
    expect(booking({ shiftStatus: "DRAFT" }).ok).toBe(false);
    expect(booking({ shiftStatus: "IN_PROGRESS" })).toEqual({ ok: false, code: "SHIFT_NOT_OPEN" });
    expect(booking({ shiftStatus: "CANCELLED" })).toEqual({ ok: false, code: "SHIFT_NOT_OPEN" });
  });

  it("rejects bad seat counts before looking at capacity", () => {
    expect(booking({ requestedSeats: 0 })).toEqual({ ok: false, code: "INVALID_SEATS" });
    expect(booking({ requestedSeats: -1 })).toEqual({ ok: false, code: "INVALID_SEATS" });
    expect(booking({ requestedSeats: 1.5 })).toEqual({ ok: false, code: "INVALID_SEATS" });
    expect(booking({ requestedSeats: 5 })).toEqual({ ok: false, code: "TOO_MANY_SEATS" });
  });

  it("shows why a lock is required: two unlocked reads both see the last seat", () => {
    const first = booking({ capacity: 1, confirmedSeats: 0 });
    const second = booking({ capacity: 1, confirmedSeats: 0 });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });
});

describe("serial lock", () => {
  it("lets only as many parallel bookings through as there are seats", async () => {
    const lock = createSerialShiftLock();
    let confirmed = 0;
    const passengers = new Set<string>();
    const capacity = 3;

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const userId = `user-${index}`;
        return lock("shift-1", () =>
          bookInTransaction({
            lockShift: async () => undefined,
            load: async (): Promise<LockedShiftView> => ({
              id: "shift-1",
              status: "OPEN",
              capacity,
              confirmedSeats: confirmed,
              passengerIds: [...passengers],
              departsAt: departsAt.toISOString(),
              lockMinutes: 30,
            }),
            insert: async (seats) => {
              confirmed += seats;
              passengers.add(userId);
              return { id: `booking-${index}` };
            },
            requestedSeats: 1,
            userId,
            now: early,
          }),
        );
      }),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok && result.code === "SHIFT_FULL")).toHaveLength(9);
    expect(confirmed).toBe(3);
  });

  it("frees a seat under the same lock so the next rider can take it", async () => {
    const lock = createSerialShiftLock();
    let confirmed = 1;
    let passengers = ["user-1"];
    const view = (): LockedShiftView => ({
      id: "shift-1",
      status: "OPEN",
      capacity: 1,
      confirmedSeats: confirmed,
      passengerIds: passengers,
      departsAt: departsAt.toISOString(),
      lockMinutes: 30,
    });

    const blocked = await lock("shift-1", () =>
      bookInTransaction({
        lockShift: async () => undefined,
        load: async () => view(),
        insert: async () => ({ id: "nope" }),
        requestedSeats: 1,
        userId: "user-2",
        now: early,
      }),
    );
    expect(blocked).toEqual({ ok: false, code: "SHIFT_FULL" });

    const cancelled = await lock("shift-1", () =>
      cancelInTransaction({
        lockShift: async () => undefined,
        load: async () => ({
          shiftStatus: "OPEN" as const,
          departsAt: departsAt.toISOString(),
          lockMinutes: 30,
          bookingStatus: "CONFIRMED" as const,
        }),
        cancel: async () => {
          confirmed = 0;
          passengers = [];
          return { id: "booking-1" };
        },
        now: early,
      }),
    );
    expect(cancelled.ok).toBe(true);

    const taken = await lock("shift-1", () =>
      bookInTransaction({
        lockShift: async () => undefined,
        load: async () => view(),
        insert: async () => {
          confirmed = 1;
          passengers = ["user-2"];
          return { id: "booking-2" };
        },
        requestedSeats: 1,
        userId: "user-2",
        now: early,
      }),
    );
    expect(taken.ok).toBe(true);
    expect(confirmed).toBe(1);
  });
});

describe("cancel, start, complete, capacity", () => {
  it("cancels only a confirmed booking before the lock", () => {
    expect(
      evaluateCancel({
        bookingStatus: "CONFIRMED",
        shiftStatus: "OPEN",
        now: early,
        departsAt,
        lockMinutes: 30,
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateCancel({
        bookingStatus: "CONFIRMED",
        shiftStatus: "OPEN",
        now: insideLock,
        departsAt,
        lockMinutes: 30,
      }),
    ).toEqual({ ok: false, code: "SHIFT_LOCKED" });
    expect(
      evaluateCancel({
        bookingStatus: "CANCELLED",
        shiftStatus: "OPEN",
        now: early,
        departsAt,
        lockMinutes: 30,
      }),
    ).toEqual({ ok: false, code: "NOT_CANCELLABLE" });
    expect(
      evaluateCancel({
        bookingStatus: "CONFIRMED",
        shiftStatus: "IN_PROGRESS",
        now: early,
        departsAt,
        lockMinutes: 30,
      }),
    ).toEqual({ ok: false, code: "SHIFT_NOT_CANCELLABLE" });
  });

  it("starts from open or locked and completes only a live route", () => {
    expect(evaluateStart("OPEN")).toEqual({ ok: true });
    expect(evaluateStart("LOCKED")).toEqual({ ok: true });
    expect(evaluateStart("DRAFT")).toEqual({ ok: false, code: "CANNOT_START" });
    expect(evaluateStart("IN_PROGRESS")).toEqual({ ok: false, code: "ALREADY_STARTED" });
    expect(evaluateComplete("IN_PROGRESS")).toEqual({ ok: true });
    expect(evaluateComplete("OPEN")).toEqual({ ok: false, code: "CANNOT_COMPLETE" });
  });

  it("keeps shift capacity inside the vehicle", () => {
    expect(assertShiftCapacity(8, 8)).toEqual({ ok: true });
    expect(assertShiftCapacity(9, 8)).toEqual({ ok: false, code: "VEHICLE_TOO_SMALL" });
    expect(assertShiftCapacity(0, null)).toEqual({ ok: false, code: "INVALID_CAPACITY" });
    expect(assertShiftCapacity(4, null)).toEqual({ ok: true });
  });
});
