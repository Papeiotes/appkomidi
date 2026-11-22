import {
  buildWaypoints,
  fallbackDurationSeconds,
  haversineMeters,
  lineString,
  toOsrmPath,
  type LatLng,
  type RouteLine,
} from "@vardia/shared";
import { env } from "./env";
import { prisma } from "./prisma";

export interface RouteResult {
  waypoints: LatLng[];
  geometry: RouteLine;
  distanceM: number;
  durationS: number;
  fallback: boolean;
}

export async function routeForShift(shiftId: string, driver: LatLng | null): Promise<RouteResult | null> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { bookings: { where: { status: "CONFIRMED" } } },
  });
  if (!shift) return null;
  const waypoints = buildWaypoints({
    driver,
    muster: { lat: shift.musterLat, lng: shift.musterLng },
    dest: { lat: shift.destLat, lng: shift.destLng },
    employeePoints: shift.bookings.map((booking) => ({ lat: booking.pickupLat, lng: booking.pickupLng })),
  });
  const straight = fallbackDistance(waypoints);
  try {
    const url = `${env.osrmUrl}/route/v1/driving/${toOsrmPath(waypoints)}?overview=full&geometries=geojson`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Vardia/0.1 (hackathon)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`OSRM ${response.status}`);
    const body = (await response.json()) as {
      routes?: { geometry: RouteLine; distance: number; duration: number }[];
    };
    const route = body.routes?.[0];
    if (!route?.geometry) throw new Error("OSRM empty");
    return {
      waypoints,
      geometry: route.geometry,
      distanceM: route.distance,
      durationS: route.duration,
      fallback: false,
    };
  } catch (error) {
    console.warn("OSRM fallback", error instanceof Error ? error.message : error);
    return {
      waypoints,
      geometry: lineString(waypoints),
      distanceM: straight,
      durationS: fallbackDurationSeconds(waypoints),
      fallback: true,
    };
  }
}

function fallbackDistance(points: LatLng[]) {
  let meters = 0;
  for (let i = 1; i < points.length; i++) meters += haversineMeters(points[i - 1], points[i]);
  return Math.round(meters);
}
