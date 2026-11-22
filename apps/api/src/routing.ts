import { lineString, toOsrmPath, type LatLng, type RouteLine } from "@vardia/shared";
import { env } from "./env";

export async function legTo(from: LatLng, to: LatLng): Promise<RouteLine> {
  return routeThrough([from, to]);
}

const routeCache = new Map<string, RouteLine>();

/** Driving line through every point. Falls back to straight segments when OSRM is down. */
export async function routeThrough(points: LatLng[]): Promise<RouteLine> {
  if (points.length < 2) return lineString(points);
  const key = points.map((point) => `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`).join(";");
  const cached = routeCache.get(key);
  if (cached) return cached;
  try {
    const url = `${env.osrmUrl}/route/v1/driving/${toOsrmPath(points)}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error("osrm");
    const body = (await response.json()) as { routes?: { geometry: RouteLine }[] };
    if (!body.routes?.[0]?.geometry?.coordinates?.length) throw new Error("osrm");
    routeCache.set(key, body.routes[0].geometry);
    return body.routes[0].geometry;
  } catch {
    const straight = lineString(points);
    routeCache.set(key, straight);
    return straight;
  }
}
