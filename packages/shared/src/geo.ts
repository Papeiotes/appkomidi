export const ARRIVAL_RADIUS_M = 50;

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const h = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinArrival(distanceM: number, radiusM = ARRIVAL_RADIUS_M): boolean {
  return distanceM <= radiusM;
}

export function shouldNotifyArrival(input: {
  distanceM: number;
  alreadyNotified: boolean;
  radiusM?: number;
}): boolean {
  return !input.alreadyNotified && isWithinArrival(input.distanceM, input.radiusM ?? ARRIVAL_RADIUS_M);
}

/** Move due north. Used by the indoor demo to place the van inside the 50 m ring. */
export function pointNorth(origin: LatLng, meters: number): LatLng {
  return {
    lat: origin.lat + meters / 111_320,
    lng: origin.lng,
  };
}

export function dedupeNearby(points: LatLng[], meters = 20): LatLng[] {
  const out: LatLng[] = [];
  for (const point of points) {
    if (!out.some((kept) => haversineMeters(point, kept) <= meters)) out.push(point);
  }
  return out;
}

export function orderByNearestNeighbor(start: LatLng, points: LatLng[]): LatLng[] {
  const remaining = points.map((point) => ({ ...point }));
  const ordered: LatLng[] = [];
  let cursor = start;
  while (remaining.length) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineMeters(cursor, remaining[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    cursor = next;
  }
  return ordered;
}

export function buildWaypoints(input: {
  driver: LatLng | null;
  muster: LatLng;
  dest: LatLng;
  employeePoints: LatLng[];
  maxPoints?: number;
}): LatLng[] {
  const start = input.driver ?? input.muster;
  const middle = orderByNearestNeighbor(start, dedupeNearby(input.employeePoints));
  const points = [start, ...middle];
  const last = points[points.length - 1];
  if (haversineMeters(last, input.dest) > 30) points.push(input.dest);
  const cap = input.maxPoints ?? 25;
  if (points.length <= cap) return points;
  const head = points.slice(0, cap - 1);
  const tail = points[points.length - 1];
  if (haversineMeters(head[head.length - 1], tail) > 1) head.push(tail);
  return head;
}

export function toOsrmPath(points: LatLng[]): string {
  return points.map((point) => `${point.lng},${point.lat}`).join(";");
}

export function fallbackDurationSeconds(points: LatLng[]): number {
  let meters = 0;
  for (let i = 1; i < points.length; i++) meters += haversineMeters(points[i - 1], points[i]);
  return Math.round(meters / 8);
}

export interface RouteLine {
  type: "LineString";
  coordinates: [number, number][];
}

export function lineString(points: LatLng[]): RouteLine {
  return {
    type: "LineString",
    coordinates: points.map((point) => [point.lng, point.lat]),
  };
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Ray cast. Ring is [lng, lat] pairs, closed or open. */
export function pointInPolygon(point: LatLng, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function assignSubArea<T extends { id: string; ring: [number, number][] }>(
  point: LatLng,
  areas: T[],
): string | null {
  return areas.find((area) => pointInPolygon(point, area.ring))?.id ?? null;
}
