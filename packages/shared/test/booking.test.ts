import { describe, expect, it } from "vitest";
import {
  assignUnderLock,
  createSerialShiftLock,
  evaluateCancel,
  evaluateCapacity,
  isValidAfm,
  kgForBracket,
  suggestSlot,
} from "../src/booking";

const start = new Date("2026-11-23T06:00:00.000Z");
const end = new Date("2026-11-23T12:00:00.000Z");
const slot = new Date("2026-11-23T08:00:00.000Z");
const now = new Date("2026-11-22T18:00:00.000Z");

function capacity(overrides: Partial<Parameters<typeof evaluateCapacity>[0]> = {}) {
  return evaluateCapacity({
    shiftStatus: "SCHEDULED",
    startsAt: start,
    endsAt: end,
    scheduledAt: slot,
    now,
    capacityKg: 100,
    usedKg: 0,
    requestedKg: 20,
    slotClosed: false,
    ...overrides,
  });
}

describe("kilograms and capacity", () => {
  it("uses the top of each bracket and a configurable 50+ weight", () => {
    expect(kgForBracket("KG_0_10")).toBe(10);
    expect(kgForBracket("KG_10_20")).toBe(20);
    expect(kgForBracket("KG_20_50")).toBe(50);
    expect(kgForBracket("KG_50_PLUS")).toBe(75);
    expect(kgForBracket("KG_50_PLUS", 80)).toBe(80);
  });

  it("accepts a pickup that fits and refuses one kilogram over", () => {
    expect(capacity({ usedKg: 80, requestedKg: 20 })).toEqual({ ok: true, remainingAfter: 0 });
    expect(capacity({ usedKg: 80, requestedKg: 21 })).toEqual({ ok: false, code: "TRUCK_FULL" });
  });

  it("refuses a started route, a closed slot, a time outside the shift, and the past", () => {
    expect(capacity({ shiftStatus: "IN_PROGRESS" })).toEqual({ ok: false, code: "SHIFT_STARTED" });
    expect(capacity({ slotClosed: true })).toEqual({ ok: false, code: "SLOT_CLOSED" });
    expect(capacity({ scheduledAt: new Date("2026-11-23T12:00:00.000Z") })).toEqual({
      ok: false,
      code: "OUTSIDE_SHIFT",
    });
    expect(capacity({ now: new Date("2026-11-23T09:00:00.000Z") })).toEqual({ ok: false, code: "IN_THE_PAST" });
  });

  it("refuses anything beyond 7 days and an off-grid minute", () => {
    expect(capacity({ scheduledAt: new Date("2026-12-05T08:00:00.000Z") })).toEqual({
      ok: false,
      code: "OUTSIDE_HORIZON",
    });
    expect(capacity({ scheduledAt: new Date("2026-11-23T08:07:00.000Z") })).toEqual({
      ok: false,
      code: "NOT_ALIGNED",
    });
  });

  it("lets a business cancel until 15 minutes before, and not after", () => {
    expect(
      evaluateCancel({ status: "CONFIRMED", scheduledAt: slot, now: new Date("2026-11-23T07:44:00.000Z") }),
    ).toEqual({ ok: true });
    expect(
      evaluateCancel({ status: "CONFIRMED", scheduledAt: slot, now: new Date("2026-11-23T07:45:00.000Z") }),
    ).toEqual({ ok: false, code: "TOO_LATE" });
    expect(evaluateCancel({ status: "COMPLETED", scheduledAt: slot, now })).toEqual({
      ok: false,
      code: "NOT_CANCELLABLE",
    });
  });

  it("validates a Greek AFM checksum", () => {
    expect(isValidAfm("090000045")).toBe(true);
    expect(isValidAfm("090000046")).toBe(false);
    expect(isValidAfm("123")).toBe(false);
  });
});

describe("row lock", () => {
  it("gives the last kilograms to only one of two parallel bookings", async () => {
    const lock = createSerialShiftLock();
    let used = 0;
    const results = await Promise.all(
      [0, 1].map((index) =>
        lock("bin", () =>
          assignUnderLock({
            lockShifts: async () => undefined,
            load: async () => [
              {
                id: "shift-1",
                status: "SCHEDULED" as const,
                startsAt: start.toISOString(),
                endsAt: end.toISOString(),
                capacityKg: 100,
                usedKg: used,
                closedSlots: [],
              },
            ],
            insert: async () => {
              used += 75;
              return { id: `b${index}` };
            },
            scheduledAt: slot,
            now,
            requestedKg: 75,
          }),
        ),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === "TRUCK_FULL")).toHaveLength(1);
    expect(used).toBe(75);
  });
});

describe("suggestion", () => {
  it("picks the bookable quarter closest to nearby pickups", () => {
    const slots = ["2026-11-23T08:00:00.000Z", "2026-11-23T10:00:00.000Z", "2026-11-23T11:00:00.000Z"];
    expect(suggestSlot(slots, ["2026-11-23T10:30:00.000Z"])).toBe("2026-11-23T10:00:00.000Z");
    expect(suggestSlot([], [])).toBeNull();
  });
});
