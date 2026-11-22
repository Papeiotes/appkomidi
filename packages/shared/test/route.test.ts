import { describe, expect, it } from "vitest";
import { optimizeRoute, rankSlots } from "../src/route";

describe("time-window route", () => {
  it("serves the nearby later stop before the far earlier one when both stay inside ±30 min", () => {
    const start = { lat: 37.974, lng: 23.729 };
    const planned = optimizeRoute({
      start,
      now: new Date("2026-11-23T12:40:00.000Z"),
      stops: [
        { id: "A", at: { lat: 37.975, lng: 23.73 }, scheduledAt: "2026-11-23T13:00:00.000Z" },
        { id: "B", at: { lat: 38.0, lng: 23.78 }, scheduledAt: "2026-11-23T14:00:00.000Z" },
        { id: "C", at: { lat: 37.976, lng: 23.731 }, scheduledAt: "2026-11-23T14:30:00.000Z" },
      ],
    });
    expect(planned.feasible).toBe(true);
    expect(planned.order).toEqual(["A", "C", "B"]);
    const a = new Date(planned.arrivals.A).getTime();
    const c = new Date(planned.arrivals.C).getTime();
    const b = new Date(planned.arrivals.B).getTime();
    expect(a).toBeGreaterThanOrEqual(Date.parse("2026-11-23T12:30:00.000Z"));
    expect(a).toBeLessThanOrEqual(Date.parse("2026-11-23T13:30:00.000Z"));
    expect(c).toBeGreaterThanOrEqual(Date.parse("2026-11-23T14:00:00.000Z"));
    expect(c).toBeLessThanOrEqual(Date.parse("2026-11-23T15:00:00.000Z"));
    expect(b).toBeGreaterThanOrEqual(Date.parse("2026-11-23T13:30:00.000Z"));
    expect(b).toBeLessThanOrEqual(Date.parse("2026-11-23T14:30:00.000Z"));
    expect(a).toBeLessThan(c);
    expect(c).toBeLessThan(b);
  });
});

describe("adding a stop to a populated shift", () => {
  it("still finds a feasible time instead of rejecting every slot", () => {
    const planned = optimizeRoute({
      start: { lat: 37.9722, lng: 23.7302 },
      now: new Date("2026-11-22T06:00:00.000Z"),
      stops: [
        { id: "exarchia", at: { lat: 37.9862, lng: 23.7342 }, scheduledAt: "2026-11-22T07:00:00.000Z" },
        { id: "plaka", at: { lat: 37.9722, lng: 23.7302 }, scheduledAt: "2026-11-22T08:00:00.000Z" },
        { id: "pangrati", at: { lat: 37.9688, lng: 23.7462 }, scheduledAt: "2026-11-22T09:00:00.000Z" },
        { id: "koukaki", at: { lat: 37.9662, lng: 23.7265 }, scheduledAt: "2026-11-22T09:30:00.000Z" },
        { id: "new", at: { lat: 37.9722, lng: 23.7302 }, scheduledAt: "2026-11-22T11:00:00.000Z" },
      ],
    });
    expect(planned.feasible).toBe(true);
    expect(planned.order).toContain("new");
  });
});

describe("suggestion ranking", () => {
  it("prefers the slot that adds the least travel next to a nearby booking", () => {
    const ranked = rankSlots({
      start: { lat: 37.975, lng: 23.73 },
      now: new Date("2026-11-23T08:00:00.000Z"),
      existing: [
        { id: "near", at: { lat: 37.975, lng: 23.73 }, scheduledAt: "2026-11-23T10:00:00.000Z" },
        { id: "far", at: { lat: 38.02, lng: 23.82 }, scheduledAt: "2026-11-23T12:00:00.000Z" },
      ],
      candidates: [
        { at: "2026-11-23T12:30:00.000Z", point: { lat: 37.976, lng: 23.731 } },
        { at: "2026-11-23T10:30:00.000Z", point: { lat: 37.976, lng: 23.731 } },
      ],
    });
    expect(ranked[0].at).toBe("2026-11-23T10:30:00.000Z");
    expect(ranked[0].feasible).toBe(true);
    expect(ranked[0].addedSeconds).toBeLessThan(ranked[1].addedSeconds);
  });
});
