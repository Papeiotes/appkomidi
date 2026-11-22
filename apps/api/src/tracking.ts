import { haversineMeters, pointNorth, shouldNotifyArrival } from "@vardia/shared";
import type { Server } from "socket.io";
import { prisma } from "./prisma";
import { notify } from "./notify";

export async function recordLocation(
  io: Server | null | undefined,
  input: {
    shiftId: string;
    driverId: string;
    lat: number;
    lng: number;
    heading?: number | null;
    speed?: number | null;
    force?: boolean;
  },
) {
  const shift = await prisma.shift.findUnique({
    where: { id: input.shiftId },
    include: { bookings: { where: { status: "CONFIRMED" } } },
  });
  if (!shift || shift.driverId !== input.driverId) return { ok: false as const, code: "NOT_ASSIGNED" };
  if (shift.status !== "IN_PROGRESS") return { ok: false as const, code: "CANNOT_START" };

  const now = new Date();
  const throttle = shift.lastPingAt && now.getTime() - shift.lastPingAt.getTime() < 2500;
  await prisma.shift.update({
    where: { id: shift.id },
    data: {
      lastLat: input.lat,
      lastLng: input.lng,
      lastHeading: input.heading ?? null,
      lastSpeed: input.speed ?? null,
      lastPingAt: now,
    },
  });
  if (!throttle || input.force) {
    await prisma.locationPing.create({
      data: {
        shiftId: shift.id,
        driverId: input.driverId,
        lat: input.lat,
        lng: input.lng,
        heading: input.heading ?? null,
        speed: input.speed ?? null,
        recordedAt: now,
      },
    });
  }

  const payload = {
    shiftId: shift.id,
    lat: input.lat,
    lng: input.lng,
    heading: input.heading ?? null,
    speed: input.speed ?? null,
    recordedAt: now.toISOString(),
  };
  io?.to(`shift:${shift.id}`).emit("shift:location", payload);

  const arrivals = await prisma.arrivalEvent.findMany({
    where: { shiftId: shift.id },
    select: { userId: true },
  });
  const already = new Set(arrivals.map((row) => row.userId));
  const fired: { userId: string; distanceM: number }[] = [];

  for (const booking of shift.bookings) {
    const distanceM = haversineMeters(
      { lat: input.lat, lng: input.lng },
      { lat: booking.pickupLat, lng: booking.pickupLng },
    );
    if (!shouldNotifyArrival({ distanceM, alreadyNotified: already.has(booking.userId) })) continue;
    try {
      await prisma.arrivalEvent.create({
        data: {
          shiftId: shift.id,
          userId: booking.userId,
          bookingId: booking.id,
          distanceM,
        },
      });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
        continue;
      }
      throw error;
    }
    const rounded = Math.round(distanceM);
    const note = await notify(io, {
      userId: booking.userId,
      type: "ARRIVAL_50M",
      titleEl: "Το βαν είναι κοντά",
      titleEn: "The van is nearby",
      bodyEl: `Απέχει ${rounded} μέτρα από το σημείο σου.`,
      bodyEn: `${rounded} metres from your point.`,
      data: { shiftId: shift.id, distanceM: rounded },
    });
    io?.to(`user:${booking.userId}`).emit("shift:arrival", {
      shiftId: shift.id,
      distanceM: rounded,
      notificationId: note.id,
    });
    io?.to(`shift:${shift.id}`).emit("shift:arrival", {
      shiftId: shift.id,
      userId: booking.userId,
      distanceM: rounded,
    });
    fired.push({ userId: booking.userId, distanceM: rounded });
    already.add(booking.userId);
  }

  return { ok: true as const, location: payload, arrivals: fired };
}

export function demoApproach(target: { lat: number; lng: number }) {
  return pointNorth(target, 30);
}
