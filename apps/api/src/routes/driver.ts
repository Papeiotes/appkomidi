import { athensDayBounds, etaForStop, isValidLatLng } from "@vardia/shared";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { HttpError, wrap } from "../http";
import { prisma } from "../prisma";
import { routeThrough } from "../routing";
import { completeCurrentStop, currentStopId, demoPoint, recordLocation, startShift } from "../tracking";

const shiftInclude = {
  truck: true,
  bookings: { include: { business: true }, orderBy: { scheduledAt: "asc" as const } },
};

export const driverRouter = Router();

driverRouter.get(
  "/driver/shift",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const { start, end } = athensDayBounds();
    const active = await prisma.shift.findFirst({
      where: { driverId: auth.id, status: { in: ["IN_PROGRESS", "PAUSED"] } },
      include: shiftInclude,
      orderBy: { startsAt: "desc" },
    });
    const scheduledToday = active
      ? null
      : await prisma.shift.findFirst({
          where: { driverId: auth.id, status: "SCHEDULED", startsAt: { lte: end }, endsAt: { gte: start } },
          include: shiftInclude,
          orderBy: { startsAt: "asc" },
        });
    const endedToday =
      active || scheduledToday
        ? null
        : await prisma.shift.findFirst({
            where: { driverId: auth.id, status: "ENDED", endedAt: { gte: start } },
            include: shiftInclude,
            orderBy: { endedAt: "desc" },
          });
    const shift = active ?? scheduledToday ?? endedToday;
    if (!shift) {
      res.json({ shift: null, stops: [], nextStopId: null, eta: null, route: null });
      return;
    }
    const confirmed = new Set(shift.bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.id));
    const next = shift.routeLocked ? currentStopId(shift.routeOrder, shift.cursor, confirmed) : null;
    const ordered = (shift.routeLocked ? shift.routeOrder : shift.bookings.map((booking) => booking.id))
      .map((id) => shift.bookings.find((booking) => booking.id === id))
      .filter((booking): booking is (typeof shift.bookings)[number] => Boolean(booking && booking.status === "CONFIRMED"));
    const here = shift.lastLat != null && shift.lastLng != null ? { lat: shift.lastLat, lng: shift.lastLng } : null;
    let route = null;
    let eta: string | null = null;
    if (shift.routeLocked && ordered.length) {
      const points = [...(here ? [here] : []), ...ordered.map((booking) => ({ lat: booking.business.lat, lng: booking.business.lng }))];
      if (points.length >= 2) route = await routeThrough(points);
      if (here && next) {
        const arrival = etaForStop({
          start: here,
          now: new Date(),
          ordered: ordered.map((booking) => ({
            id: booking.id,
            at: { lat: booking.business.lat, lng: booking.business.lng },
            scheduledAt: booking.scheduledAt.toISOString(),
          })),
          targetId: next.id,
        });
        eta = arrival?.toISOString() ?? null;
      }
    }
    res.json({
      shift: {
        id: shift.id,
        status: shift.status,
        startsAt: shift.startsAt.toISOString(),
        endsAt: shift.endsAt.toISOString(),
        binType: shift.truck.binType,
        routeLocked: shift.routeLocked,
        routeOrder: shift.routeOrder,
        lastLat: shift.lastLat,
        lastLng: shift.lastLng,
      },
      stops: shift.bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        scheduledAt: booking.scheduledAt.toISOString(),
        kg: booking.kg,
        bracket: booking.bracket,
        binType: booking.binType,
        business: booking.business.name,
        phone: booking.business.phone,
        lat: booking.business.lat,
        lng: booking.business.lng,
        label: booking.business.addressLabel,
      })),
      nextStopId: next?.id ?? null,
      eta,
      route,
    });
  }),
);

driverRouter.post(
  "/driver/shifts/:id/start",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const body = z.object({ lat: z.number(), lng: z.number() }).parse(req.body);
    if (!isValidLatLng(body.lat, body.lng)) throw new HttpError(400, "BAD_INPUT");
    const result = await startShift((req as AuthedRequest).auth.id, String(req.params.id), body);
    if (!result.ok) throw new HttpError(409, result.code);
    const io = req.app.get("io") as Server | undefined;
    io?.to(`shift:${result.shift.id}`).emit("shift:status", { shiftId: result.shift.id, status: result.shift.status });
    res.json({ shift: result.shift });
  }),
);

driverRouter.post(
  "/driver/shifts/:id/location",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const body = z.object({ lat: z.number(), lng: z.number() }).parse(req.body);
    const io = req.app.get("io") as Server | undefined;
    const result = await recordLocation(io, {
      shiftId: String(req.params.id),
      driverId: (req as AuthedRequest).auth.id,
      lat: body.lat,
      lng: body.lng,
    });
    if (!result.ok) throw new HttpError(409, result.code);
    res.json(result);
  }),
);

driverRouter.post(
  "/driver/shifts/:id/simulate",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const shift = await prisma.shift.findUnique({
      where: { id: String(req.params.id) },
      include: { bookings: { where: { status: "CONFIRMED" }, include: { business: true } } },
    });
    if (!shift || shift.driverId !== (req as AuthedRequest).auth.id) throw new HttpError(404, "NOT_YOUR_SHIFT");
    const confirmed = new Set(shift.bookings.map((booking) => booking.id));
    const next = currentStopId(shift.routeOrder, shift.cursor, confirmed);
    const booking = shift.bookings.find((row) => row.id === next?.id);
    if (!booking) throw new HttpError(404, "NOT_FOUND");
    const point = demoPoint({ lat: booking.business.lat, lng: booking.business.lng });
    const io = req.app.get("io") as Server | undefined;
    const result = await recordLocation(io, {
      shiftId: shift.id,
      driverId: shift.driverId,
      ...point,
      force: true,
    });
    res.json(result);
  }),
);

driverRouter.post(
  "/driver/shifts/:id/complete",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const io = req.app.get("io") as Server | undefined;
    const result = await completeCurrentStop((req as AuthedRequest).auth.id, String(req.params.id), io);
    if (!result.ok) throw new HttpError(409, result.code);
    res.json(result);
  }),
);

driverRouter.post(
  "/driver/shifts/:id/pause",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const shift = await prisma.shift.findFirst({
      where: { id: String(req.params.id), driverId: (req as AuthedRequest).auth.id, status: "IN_PROGRESS" },
    });
    if (!shift) throw new HttpError(409, "SHIFT_STARTED");
    const updated = await prisma.shift.update({ where: { id: shift.id }, data: { status: "PAUSED" } });
    res.json({ shift: updated });
  }),
);

driverRouter.post(
  "/driver/shifts/:id/resume",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const shift = await prisma.shift.findFirst({
      where: { id: String(req.params.id), driverId: (req as AuthedRequest).auth.id, status: "PAUSED" },
    });
    if (!shift) throw new HttpError(409, "SHIFT_STARTED");
    const updated = await prisma.shift.update({ where: { id: shift.id }, data: { status: "IN_PROGRESS" } });
    res.json({ shift: updated });
  }),
);

driverRouter.post(
  "/driver/shifts/:id/end",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const shift = await prisma.shift.findFirst({
      where: { id: String(req.params.id), driverId: (req as AuthedRequest).auth.id, status: { in: ["IN_PROGRESS", "PAUSED"] } },
    });
    if (!shift) throw new HttpError(409, "SHIFT_STARTED");
    const updated = await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    res.json({ shift: updated });
  }),
);
