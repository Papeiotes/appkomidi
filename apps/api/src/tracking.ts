import { etaForStop, optimizeRoute, pointNorth, shouldNotifyArrival, haversineMeters, FLEX_MINUTES, type LatLng } from "@vardia/shared";
import type { Server } from "socket.io";
import { prisma } from "./prisma";
import { notify } from "./notify";
import { legTo } from "./routing";

export async function startShift(driverId: string, shiftId: string, origin: LatLng, io?: Server | null) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { bookings: { where: { status: "CONFIRMED" }, include: { business: true } } },
  });
  if (!shift || shift.driverId !== driverId) return { ok: false as const, code: "NOT_YOUR_SHIFT" };
  if (shift.status !== "SCHEDULED") return { ok: false as const, code: "SHIFT_STARTED" };
  const now = new Date();
  const planned = optimizeRoute({
    start: origin,
    now,
    stops: shift.bookings.map((booking) => ({
      id: booking.id,
      at: { lat: booking.business.lat, lng: booking.business.lng },
      scheduledAt: booking.scheduledAt.toISOString(),
    })),
  });
  const order = planned.order;
  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      status: order.length ? "IN_PROGRESS" : "ENDED",
      routeLocked: true,
      routeOrder: order,
      cursor: 0,
      startedAt: new Date(),
      endedAt: order.length ? null : new Date(),
      lastLat: origin.lat,
      lastLng: origin.lng,
      lastPingAt: now,
    },
  });
  await publishEtas(io, shift.bookings, planned.arrivals, shift.id);
  return { ok: true as const, shift: updated };
}

export async function publishEtas(
  io: Server | null | undefined,
  bookings: { id: string; business: { userId: string } }[],
  arrivals: Record<string, string>,
  shiftId: string,
) {
  for (const booking of bookings) {
    const eta = arrivals[booking.id];
    if (!eta) continue;
    io?.to(`user:${booking.business.userId}`).emit("booking:eta", { bookingId: booking.id, shiftId, eta });
    io?.to(`shift:${shiftId}`).emit("booking:eta", { bookingId: booking.id, shiftId, eta });
  }
}

export function currentStopId(routeOrder: string[], cursor: number, confirmedIds: Set<string>) {
  for (let i = cursor; i < routeOrder.length; i++) {
    if (confirmedIds.has(routeOrder[i])) return { id: routeOrder[i], index: i };
  }
  return null;
}

export async function recordLocation(
  io: Server | null | undefined,
  input: { shiftId: string; driverId: string; lat: number; lng: number; force?: boolean },
) {
  const shift = await prisma.shift.findUnique({
    where: { id: input.shiftId },
    include: { bookings: { where: { status: "CONFIRMED" }, include: { business: true } } },
  });
  if (!shift || shift.driverId !== input.driverId) return { ok: false as const, code: "NOT_YOUR_SHIFT" };
  if (shift.status !== "IN_PROGRESS" && shift.status !== "PAUSED") return { ok: false as const, code: "SHIFT_STARTED" };
  const now = new Date();
  await prisma.shift.update({
    where: { id: shift.id },
    data: { lastLat: input.lat, lastLng: input.lng, lastPingAt: now },
  });
  if (!shift.lastPingAt || now.getTime() - shift.lastPingAt.getTime() > 2500 || input.force) {
    await prisma.locationPing.create({
      data: { shiftId: shift.id, lat: input.lat, lng: input.lng, recordedAt: now },
    });
  }
  const here = { lat: input.lat, lng: input.lng };
  io?.to(`shift:${shift.id}`).emit("shift:location", { shiftId: shift.id, ...here, recordedAt: now.toISOString(), paused: shift.status === "PAUSED" });

  let arrival: { bookingId: string; distanceM: number } | null = null;
  if (shift.status === "IN_PROGRESS") {
    const confirmed = new Set(shift.bookings.map((booking) => booking.id));
    const next = currentStopId(shift.routeOrder, shift.cursor, confirmed);
    const booking = next ? shift.bookings.find((row) => row.id === next.id) : undefined;
    if (booking) {
      const distanceM = haversineMeters(here, { lat: booking.business.lat, lng: booking.business.lng });
      const ordered = shift.routeOrder
        .map((id) => shift.bookings.find((row) => row.id === id))
        .filter((row): row is (typeof shift.bookings)[number] => Boolean(row))
        .map((row) => ({
          id: row.id,
          at: { lat: row.business.lat, lng: row.business.lng },
          scheduledAt: row.scheduledAt.toISOString(),
        }));
      const eta = etaForStop({ start: here, now, ordered, targetId: booking.id });
      const windowEnd = booking.scheduledAt.getTime() + FLEX_MINUTES * 60_000;
      if (eta && eta.getTime() > windowEnd) {
        const planned = optimizeRoute({
          start: here,
          now,
          stops: shift.bookings
            .filter((row) => confirmed.has(row.id))
            .map((row) => ({
              id: row.id,
              at: { lat: row.business.lat, lng: row.business.lng },
              scheduledAt: row.scheduledAt.toISOString(),
            })),
        });
        if (planned.order.join() !== shift.routeOrder.filter((id) => confirmed.has(id)).join()) {
          await prisma.shift.update({ where: { id: shift.id }, data: { routeOrder: planned.order, cursor: 0 } });
          await publishEtas(io, shift.bookings.filter((row) => confirmed.has(row.id)), planned.arrivals, shift.id);
        }
      }
      if (shouldNotifyArrival({ distanceM, alreadyNotified: booking.arrivalNotified })) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { arrivalOpen: true, arrivalNotified: true },
        });
        await notify(io, {
          userId: booking.business.userId,
          type: "ARRIVAL_50M",
          titleEl: "Το απορριμματοφόρο έφτασε",
          titleEn: "The truck has arrived",
          bodyEl: "Είναι μέσα στα 50 μέτρα από το σημείο σου.",
          bodyEn: "It is within 50 metres of your pin.",
          data: { bookingId: booking.id, shiftId: shift.id },
        });
        io?.to(`user:${booking.business.userId}`).emit("shift:arrival", { bookingId: booking.id, shiftId: shift.id });
        arrival = { bookingId: booking.id, distanceM: Math.round(distanceM) };
      }
    }
  }
  return { ok: true as const, location: here, arrival };
}

export async function completeCurrentStop(driverId: string, shiftId: string, io?: Server | null) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { bookings: { include: { business: true } } },
  });
  if (!shift || shift.driverId !== driverId) return { ok: false as const, code: "NOT_YOUR_SHIFT" };
  if (shift.status !== "IN_PROGRESS") return { ok: false as const, code: "SHIFT_STARTED" };
  const confirmed = new Set(shift.bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.id));
  const next = currentStopId(shift.routeOrder, shift.cursor, confirmed);
  if (!next) {
    await prisma.shift.update({ where: { id: shift.id }, data: { status: "ENDED", endedAt: new Date() } });
    return { ok: true as const, done: true };
  }
  await prisma.booking.update({
    where: { id: next.id },
    data: { status: "COMPLETED", completedAt: new Date(), arrivalOpen: false },
  });
  const finished = shift.bookings.find((row) => row.id === next.id);
  if (finished) {
    await notify(io, {
      userId: finished.business.userId,
      type: "BOOKING_COMPLETED",
      titleEl: "Η αποκομιδή ολοκληρώθηκε",
      titleEn: "Pickup completed",
      bodyEl: "Ο οδηγός παρέλαβε τους κάδους.",
      bodyEn: "The driver collected the bins.",
      data: { bookingId: finished.id },
    });
  }
  const remaining = shift.bookings.filter((booking) => booking.status === "CONFIRMED" && booking.id !== next.id);
  if (!remaining.length || shift.lastLat == null || shift.lastLng == null) {
    await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "ENDED", endedAt: new Date(), cursor: shift.routeOrder.length },
    });
    io?.to(`shift:${shift.id}`).emit("shift:status", { shiftId: shift.id, status: "ENDED" });
    return { ok: true as const, done: true, bookingId: next.id };
  }
  const planned = optimizeRoute({
    start: { lat: shift.lastLat, lng: shift.lastLng },
    now: new Date(),
    stops: remaining.map((booking) => ({
      id: booking.id,
      at: { lat: booking.business.lat, lng: booking.business.lng },
      scheduledAt: booking.scheduledAt.toISOString(),
    })),
  });
  await prisma.shift.update({
    where: { id: shift.id },
    data: { routeOrder: planned.order, cursor: 0 },
  });
  await publishEtas(io, remaining, planned.arrivals, shift.id);
  io?.to(`shift:${shift.id}`).emit("shift:status", { shiftId: shift.id, status: "IN_PROGRESS" });
  return { ok: true as const, done: false, bookingId: next.id };
}

export function demoPoint(target: LatLng) {
  return pointNorth(target, 30);
}

export async function previewEta(shiftId: string, bookingId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { bookings: { include: { business: true } } },
  });
  if (!shift || shift.lastLat == null || shift.lastLng == null) return null;
  const byId = new Map(shift.bookings.map((booking) => [booking.id, booking]));
  const ordered = shift.routeOrder
    .map((id) => byId.get(id))
    .filter((booking): booking is NonNullable<typeof booking> => Boolean(booking && booking.status === "CONFIRMED"))
    .map((booking) => ({
      id: booking.id,
      at: { lat: booking.business.lat, lng: booking.business.lng },
      scheduledAt: booking.scheduledAt.toISOString(),
    }));
  const eta = etaForStop({
    start: { lat: shift.lastLat, lng: shift.lastLng },
    now: new Date(),
    ordered,
    targetId: bookingId,
  });
  const next = ordered[0];
  const leg = next ? await legTo({ lat: shift.lastLat, lng: shift.lastLng }, next.at) : null;
  return { eta, leg, ordered };
}
