import { FLEX_MINUTES, SERVICE_MINUTES } from "./booking";
import { haversineMeters, type LatLng } from "./geo";

export interface RouteStop {
  id: string;
  at: LatLng;
  scheduledAt: string;
}

export function travelSecondsHaversine(from: LatLng, to: LatLng, metersPerSecond = 8): number {
  return haversineMeters(from, to) / metersPerSecond;
}

/**
 * Order stops from the driver's position. Prefer arrivals inside the ±15 min
 * window, then the shortest hop. Service time is 15 minutes. The route ends
 * at the last stop.
 */
export function orderStops(input: {
  start: LatLng;
  now: Date;
  stops: RouteStop[];
  travelSeconds?: (from: LatLng, to: LatLng) => number;
  serviceMinutes?: number;
  flexMinutes?: number;
}): string[] {
  const travel = input.travelSeconds ?? travelSecondsHaversine;
  const serviceMs = (input.serviceMinutes ?? SERVICE_MINUTES) * 60_000;
  const flexMs = (input.flexMinutes ?? FLEX_MINUTES) * 60_000;
  const remaining = [...input.stops];
  const order: string[] = [];
  let cursor = input.start;
  let clock = input.now.getTime();

  while (remaining.length) {
    let best = 0;
    let bestKey = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const stop = remaining[i];
      const hop = travel(cursor, stop.at) * 1000;
      const scheduled = new Date(stop.scheduledAt).getTime();
      let arrival = clock + hop;
      if (arrival < scheduled - flexMs) arrival = scheduled - flexMs;
      const late = Math.max(0, arrival - (scheduled + flexMs));
      const key = late * 1_000_000 + hop;
      if (key < bestKey) {
        bestKey = key;
        best = i;
      }
    }
    const [next] = remaining.splice(best, 1);
    const hop = travel(cursor, next.at) * 1000;
    const scheduled = new Date(next.scheduledAt).getTime();
    let arrival = clock + hop;
    if (arrival < scheduled - flexMs) arrival = scheduled - flexMs;
    clock = arrival + serviceMs;
    cursor = next.at;
    order.push(next.id);
  }
  return order;
}

export function etaForStop(input: {
  start: LatLng;
  now: Date;
  ordered: RouteStop[];
  targetId: string;
  travelSeconds?: (from: LatLng, to: LatLng) => number;
}): Date | null {
  const travel = input.travelSeconds ?? travelSecondsHaversine;
  const flexMs = FLEX_MINUTES * 60_000;
  let cursor = input.start;
  let clock = input.now.getTime();
  for (const stop of input.ordered) {
    let arrival = clock + travel(cursor, stop.at) * 1000;
    const scheduled = new Date(stop.scheduledAt).getTime();
    if (arrival < scheduled - flexMs) arrival = scheduled - flexMs;
    if (stop.id === input.targetId) return new Date(arrival);
    clock = arrival + SERVICE_MINUTES * 60_000;
    cursor = stop.at;
  }
  return null;
}
