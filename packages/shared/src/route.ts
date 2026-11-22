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

interface Simulation {
  feasible: boolean;
  travelMs: number;
  latenessMs: number;
  arrivals: Map<string, number>;
}

function simulate(
  start: LatLng,
  now: Date,
  order: RouteStop[],
  travel: (from: LatLng, to: LatLng) => number,
  serviceMs: number,
  flexMs: number,
): Simulation {
  let cursor = start;
  let clock = now.getTime();
  let travelMs = 0;
  let latenessMs = 0;
  const arrivals = new Map<string, number>();
  let feasible = true;
  for (const stop of order) {
    const hop = travel(cursor, stop.at) * 1000;
    travelMs += hop;
    let arrival = clock + hop;
    const scheduled = new Date(stop.scheduledAt).getTime();
    const open = scheduled - flexMs;
    const close = scheduled + flexMs;
    if (arrival < open) arrival = open;
    if (arrival > close) {
      latenessMs += arrival - close;
      feasible = false;
    }
    arrivals.set(stop.id, arrival);
    clock = arrival + serviceMs;
    cursor = stop.at;
  }
  return { feasible, travelMs, latenessMs, arrivals };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.map((item) => item)];
  const out: T[][] = [];
  for (let index = 0; index < items.length; index++) {
    const rest = items.slice(0, index).concat(items.slice(index + 1));
    for (const tail of permutations(rest)) out.push([items[index], ...tail]);
  }
  return out;
}

function better(a: Simulation, b: Simulation): boolean {
  if (a.feasible !== b.feasible) return a.feasible;
  if (a.feasible) return a.travelMs < b.travelMs;
  if (a.latenessMs !== b.latenessMs) return a.latenessMs < b.latenessMs;
  return a.travelMs < b.travelMs;
}

function improve(start: LatLng, now: Date, order: RouteStop[], travel: (from: LatLng, to: LatLng) => number, serviceMs: number, flexMs: number): RouteStop[] {
  let current = [...order];
  let currentSim = simulate(start, now, current, travel, serviceMs, flexMs);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const next = current.slice(0, i).concat(current.slice(i, j + 1).reverse(), current.slice(j + 1));
        const sim = simulate(start, now, next, travel, serviceMs, flexMs);
        if (better(sim, currentSim)) {
          current = next;
          currentSim = sim;
          changed = true;
        }
      }
    }
    for (let from = 0; from < current.length; from++) {
      for (let to = 0; to < current.length; to++) {
        if (from === to) continue;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        const sim = simulate(start, now, next, travel, serviceMs, flexMs);
        if (better(sim, currentSim)) {
          current = next;
          currentSim = sim;
          changed = true;
        }
      }
    }
  }
  return current;
}

export interface OptimizedRoute {
  order: string[];
  arrivals: Record<string, string>;
  feasible: boolean;
  travelSeconds: number;
}

/**
 * One-vehicle route with a ±flex window around each booked time and a fixed
 * service duration. Small routes are solved exactly. Larger ones start from
 * feasible insertion and then 2-opt / or-opt.
 */
export function optimizeRoute(input: {
  start: LatLng;
  now: Date;
  stops: RouteStop[];
  travelSeconds?: (from: LatLng, to: LatLng) => number;
  serviceMinutes?: number;
  flexMinutes?: number;
}): OptimizedRoute {
  const travel = input.travelSeconds ?? travelSecondsHaversine;
  const serviceMs = (input.serviceMinutes ?? SERVICE_MINUTES) * 60_000;
  const flexMs = (input.flexMinutes ?? FLEX_MINUTES) * 60_000;
  const stops = input.stops;
  if (!stops.length) return { order: [], arrivals: {}, feasible: true, travelSeconds: 0 };

  let bestOrder = stops;
  let best = simulate(input.start, input.now, stops, travel, serviceMs, flexMs);

  if (stops.length <= 7) {
    for (const candidate of permutations(stops)) {
      const sim = simulate(input.start, input.now, candidate, travel, serviceMs, flexMs);
      if (better(sim, best)) {
        best = sim;
        bestOrder = candidate;
      }
    }
  } else {
    const seed = improve(input.start, input.now, stops, travel, serviceMs, flexMs);
    const sim = simulate(input.start, input.now, seed, travel, serviceMs, flexMs);
    best = sim;
    bestOrder = seed;
  }

  const arrivals: Record<string, string> = {};
  for (const [id, at] of best.arrivals) arrivals[id] = new Date(at).toISOString();
  return { order: bestOrder.map((stop) => stop.id), arrivals, feasible: best.feasible, travelSeconds: best.travelMs / 1000 };
}

export function orderStops(input: {
  start: LatLng;
  now: Date;
  stops: RouteStop[];
  travelSeconds?: (from: LatLng, to: LatLng) => number;
  serviceMinutes?: number;
  flexMinutes?: number;
}): string[] {
  return optimizeRoute(input).order;
}

export function etaForStop(input: {
  start: LatLng;
  now: Date;
  ordered: RouteStop[];
  targetId: string;
  travelSeconds?: (from: LatLng, to: LatLng) => number;
}): Date | null {
  const travel = input.travelSeconds ?? travelSecondsHaversine;
  const sim = simulate(input.start, input.now, input.ordered, travel, SERVICE_MINUTES * 60_000, FLEX_MINUTES * 60_000);
  const at = sim.arrivals.get(input.targetId);
  return at == null ? null : new Date(at);
}

export interface RankedSlot {
  at: string;
  addedSeconds: number;
  feasible: boolean;
}

/** Rank candidate times by how many extra travel seconds they add to the route. */
export function rankSlots(input: {
  start: LatLng;
  now: Date;
  existing: RouteStop[];
  candidates: { at: string; point: LatLng }[];
  travelSeconds?: (from: LatLng, to: LatLng) => number;
}): RankedSlot[] {
  const base = optimizeRoute({ start: input.start, now: input.now, stops: input.existing, travelSeconds: input.travelSeconds });
  const ranked = input.candidates.map((candidate) => {
    const planned = optimizeRoute({
      start: input.start,
      now: input.now,
      stops: [...input.existing, { id: `candidate:${candidate.at}`, at: candidate.point, scheduledAt: candidate.at }],
      travelSeconds: input.travelSeconds,
    });
    const nearest = input.existing.reduce((best, stop) => {
      const gap = Math.abs(new Date(stop.scheduledAt).getTime() - new Date(candidate.at).getTime());
      return Math.min(best, gap);
    }, Number.POSITIVE_INFINITY);
    return {
      at: candidate.at,
      addedSeconds: planned.feasible ? Math.max(0, planned.travelSeconds - base.travelSeconds) : Number.POSITIVE_INFINITY,
      feasible: planned.feasible,
      nearest,
    };
  });
  ranked.sort((a, b) => a.addedSeconds - b.addedSeconds || a.nearest - b.nearest || a.at.localeCompare(b.at));
  return ranked.map(({ at, addedSeconds, feasible }) => ({ at, addedSeconds, feasible }));
}
