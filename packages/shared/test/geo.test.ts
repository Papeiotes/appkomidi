import { describe, expect, it } from "vitest";
import {
  ARRIVAL_RADIUS_M,
  buildWaypoints,
  haversineMeters,
  orderByNearestNeighbor,
  pointNorth,
  shouldNotifyArrival,
} from "../src/geo";

const syntagma = { lat: 37.9755, lng: 23.7348 };

describe("arrival radius", () => {
  it("measures about 50 metres due north", () => {
    const near = pointNorth(syntagma, 50);
    const distance = haversineMeters(syntagma, near);
    expect(distance).toBeGreaterThan(49);
    expect(distance).toBeLessThan(51);
  });

  it("notifies at 50 metres once, and stays quiet at 51", () => {
    expect(ARRIVAL_RADIUS_M).toBe(50);
    expect(shouldNotifyArrival({ distanceM: 50, alreadyNotified: false })).toBe(true);
    expect(shouldNotifyArrival({ distanceM: 49, alreadyNotified: false })).toBe(true);
    expect(shouldNotifyArrival({ distanceM: 50.01, alreadyNotified: false })).toBe(false);
    expect(shouldNotifyArrival({ distanceM: 10, alreadyNotified: true })).toBe(false);
  });

  it("places the indoor demo point inside the ring", () => {
    const demo = pointNorth(syntagma, 30);
    expect(shouldNotifyArrival({ distanceM: haversineMeters(syntagma, demo), alreadyNotified: false })).toBe(true);
  });
});

describe("route order", () => {
  it("visits the nearer stop first", () => {
    const start = { lat: 0, lng: 0 };
    const near = { lat: 0, lng: 0.001 };
    const far = { lat: 0, lng: 1 };
    expect(orderByNearestNeighbor(start, [far, near])).toEqual([near, far]);
  });

  it("starts at the driver, visits riders, then the workplace", () => {
    const driver = { lat: 38, lng: 23.7 };
    const rider = { lat: 38.01, lng: 23.7 };
    const work = { lat: 38.05, lng: 23.72 };
    const points = buildWaypoints({
      driver,
      muster: { lat: 37.9, lng: 23.6 },
      dest: work,
      employeePoints: [rider],
    });
    expect(points[0]).toEqual(driver);
    expect(points[1]).toEqual(rider);
    expect(points[points.length - 1]).toEqual(work);
  });
});
