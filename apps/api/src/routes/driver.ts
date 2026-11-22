import { isValidLatLng } from "@vardia/shared";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { HttpError, wrap } from "../http";
import { prisma } from "../prisma";
import { legTo } from "../routing";
import { completeCurrentStop, currentStopId, demoPoint, recordLocation, startShift } from "../tracking";

export const driverRouter = Router();

driverRouter.get(
  "/driver/shift",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const shift = await prisma.shift.findFirst({
      where: {
        driverId: auth.id,
        status: { in: ["SCHEDULED", "IN_PROGRESS", "PAUSED"] },
        endsAt: { gte: startOfDay },
      },
      include: {
        truck: true,
        bookings: { include: { business: true }, orderBy: { scheduledAt: "asc" } },
      },
      orderBy: { startsAt: "asc" },
    });
    if (!shift) {
      res.json({ shift: null });
      return;
    }
    const confirmed = new Set(shift.bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.id));
    const next = currentStopId(shift.routeOrder, shift.cursor, confirmed);
    const nextBooking = next ? shift.bookings.find((booking) => booking.id === next.id) : null;
    let leg = null;
    if (nextBooking && shift.lastLat != null && shift.lastLng != null && shift.routeLocked) {
      leg = await legTo(
        { lat: shift.lastLat, lng: shift.lastLng },
        { lat: nextBooking.business.lat, lng: nextBooking.business.lng },
      );
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
      leg,
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
