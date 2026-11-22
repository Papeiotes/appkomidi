import { lineString, toOsrmPath, type LatLng, type RouteLine } from "@vardia/shared";
import { env } from "./env";

export async function legTo(from: LatLng, to: LatLng): Promise<RouteLine> {
  try {
    const url = `${env.osrmUrl}/route/v1/driving/${toOsrmPath([from, to])}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("osrm");
    const body = (await response.json()) as { routes?: { geometry: RouteLine }[] };
    if (!body.routes?.[0]?.geometry) throw new Error("osrm");
    return body.routes[0].geometry;
  } catch {
    return lineString([from, to]);
  }
}
