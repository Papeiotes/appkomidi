import {
  evaluateBooking,
  isLockedByTime,
  remainingSeats,
  type ShiftStatus,
} from "@vardia/shared";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "./auth";
import { prisma } from "./prisma";

export const shiftInclude = {
  business: { select: { id: true, name: true, status: true, address: true, lat: true, lng: true } },
  driver: { select: { id: true, name: true, email: true, phone: true } },
  vehicle: true,
} satisfies Prisma.ShiftInclude;

export type ShiftRow = Prisma.ShiftGetPayload<{ include: typeof shiftInclude }>;

export async function syncLock<T extends { id: string; status: ShiftStatus; departsAt: Date; lockMinutes: number }>(
  shift: T,
): Promise<T> {
  if (shift.status === "OPEN" && isLockedByTime(new Date(), shift.departsAt, shift.lockMinutes)) {
    await prisma.shift.update({ where: { id: shift.id }, data: { status: "LOCKED" } });
    return { ...shift, status: "LOCKED" };
  }
  return shift;
}

export async function seatMap(shiftIds: string[]) {
  const map = new Map<string, number>();
  if (shiftIds.length === 0) return map;
  const rows = await prisma.booking.groupBy({
    by: ["shiftId"],
    where: { shiftId: { in: shiftIds }, status: "CONFIRMED" },
    _sum: { seats: true },
  });
  for (const row of rows) map.set(row.shiftId, row._sum.seats ?? 0);
  return map;
}

export function toShift(shift: ShiftRow, confirmedSeats: number, viewerId?: string) {
  const decision = evaluateBooking({
    shiftStatus: shift.status,
    capacity: shift.capacity,
    confirmedSeats,
    alreadyBooked: false,
    requestedSeats: 1,
    now: new Date(),
    departsAt: shift.departsAt,
    lockMinutes: shift.lockMinutes,
  });
  return {
    id: shift.id,
    businessId: shift.businessId,
    businessName: shift.business.name,
    title: shift.title,
    direction: shift.direction,
    departsAt: shift.departsAt.toISOString(),
    capacity: shift.capacity,
    lockMinutes: shift.lockMinutes,
    status: shift.status,
    notes: shift.notes,
    muster: { lat: shift.musterLat, lng: shift.musterLng, label: shift.musterLabel },
    destination: { lat: shift.destLat, lng: shift.destLng, label: shift.destLabel },
    driver: shift.driver
      ? { id: shift.driver.id, name: shift.driver.name, email: shift.driver.email, phone: shift.driver.phone }
      : null,
    vehicle: shift.vehicle
      ? { id: shift.vehicle.id, plate: shift.vehicle.plate, label: shift.vehicle.label, seats: shift.vehicle.seats }
      : null,
    confirmedSeats,
    remainingSeats: remainingSeats(shift.capacity, confirmedSeats),
    bookable: decision.ok,
    viewerId,
    location:
      shift.lastLat == null || shift.lastLng == null
        ? null
        : {
            lat: shift.lastLat,
            lng: shift.lastLng,
            heading: shift.lastHeading,
            speed: shift.lastSpeed,
            recordedAt: shift.lastPingAt?.toISOString() ?? null,
          },
  };
}

export async function loadShift(id: string) {
  const shift = await prisma.shift.findUnique({ where: { id }, include: shiftInclude });
  if (!shift) return null;
  return syncLock(shift);
}

export async function canWatch(auth: AuthUser, shiftId: string) {
  const shift = await loadShift(shiftId);
  if (!shift) return null;
  if (auth.role === "ADMIN") return shift;
  if (auth.role === "DRIVER" && shift.driverId === auth.id) return shift;
  if (auth.businessId && shift.businessId === auth.businessId) return shift;
  return null;
}

export function defaultPoint(shift: ShiftRow) {
  if (shift.direction === "TO_WORK") {
    return { lat: shift.musterLat, lng: shift.musterLng, label: shift.musterLabel };
  }
  return { lat: shift.destLat, lng: shift.destLng, label: shift.destLabel };
}
