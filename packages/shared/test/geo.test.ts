import { describe, expect, it } from "vitest";
import { assignSubArea, haversineMeters, pointInPolygon, pointNorth, shouldNotifyArrival } from "../src/geo";
import { orderStops } from "../src/route";

const pin = { lat: 37.9755, lng: 23.7348 };

describe("arrival and areas", () => {
  it("opens the 50 m ring and stays quiet at 51", () => {
    const near = pointNorth(pin, 30);
    expect(shouldNotifyArrival({ distanceM: haversineMeters(pin, near), alreadyNotified: false })).toBe(true);
    expect(shouldNotifyArrival({ distanceM: 50, alreadyNotified: false })).toBe(true);
    expect(shouldNotifyArrival({ distanceM: 51, alreadyNotified: false })).toBe(false);
    expect(shouldNotifyArrival({ distanceM: 10, alreadyNotified: true })).toBe(false);
  });

  it("assigns a pin to the polygon that contains it", () => {
    const ring: [number, number][] = [
      [23.7, 37.97],
      [23.76, 37.97],
      [23.76, 38.0],
      [23.7, 38.0],
    ];
    expect(pointInPolygon(pin, ring)).toBe(true);
    expect(pointInPolygon({ lat: 38.2, lng: 23.73 }, ring)).toBe(false);
    expect(assignSubArea(pin, [{ id: "center", ring }])).toBe("center");
  });
});

describe("route order", () => {
  it("keeps an earlier nearby stop ahead of a later far one when both fit their windows", () => {
    const order = orderStops({
      start: { lat: 37.98, lng: 23.72 },
      now: new Date("2026-11-23T07:00:00.000Z"),
      stops: [
        { id: "later", at: { lat: 38.05, lng: 23.9 }, scheduledAt: "2026-11-23T09:00:00.000Z" },
        { id: "sooner", at: { lat: 37.982, lng: 23.722 }, scheduledAt: "2026-11-23T07:30:00.000Z" },
      ],
    });
    expect(order).toEqual(["sooner", "later"]);
  });

  it("does not append a depot after the last stop", () => {
    const order = orderStops({
      start: pin,
      now: new Date("2026-11-23T08:00:00.000Z"),
      stops: [{ id: "only", at: pointNorth(pin, 400), scheduledAt: "2026-11-23T08:15:00.000Z" }],
    });
    expect(order).toEqual(["only"]);
  });
});
