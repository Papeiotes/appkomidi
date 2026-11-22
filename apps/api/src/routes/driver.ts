import { evaluateComplete, evaluateStart, isValidLatLng } from "@vardia/shared";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { HttpError, wrap } from "../http";
import { notify } from "../notify";
import { prisma } from "../prisma";
import { seatMap, shiftInclude, syncLock, toShift } from "../shiftView";
import { demoApproach, recordLocation } from "../tracking";

export const driverRouter = Router();

driverRouter.get(
  "/driver/shifts",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const shifts = await prisma.shift.findMany({
      where: {
        driverId: auth.id,
        status: { in: ["OPEN", "LOCKED", "IN_PROGRESS"] },
      },
      include: shiftInclude,
      orderBy: { departsAt: "asc" },
      take: 30,
    });
    const synced = await Promise.all(shifts.map((shift) => syncLock(shift)));
    const seats = await seatMap(synced.map((shift) => shift.id));
    res.json({ shifts: synced.map((shift) => toShift(shift, seats.get(shift.id) ?? 0)) });
  }),
);

driverRouter.post(
  "/driver/shifts/:id/start",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const shift = await prisma.shift.findUnique({
      where: { id: String(req.params.id) },
      include: { bookings: { where: { status: "CONFIRMED" } } },
    });
    if (!shift || shift.driverId !== auth.id) throw new HttpError(404, "NOT_ASSIGNED");
    const decision = evaluateStart(shift.status);
    if (!decision.ok) throw new HttpError(409, decision.code);
    const updated = await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
      include: shiftInclude,
    });
    const io = req.app.get("io") as Server | undefined;
    io?.to(`shift:${shift.id}`).emit("shift:status", { shiftId: shift.id, status: "IN_PROGRESS" });
    for (const booking of shift.bookings) {
      await notify(io, {
        userId: booking.userId,
        type: "SHIFT_STARTED",
        titleEl: "Η διαδρομή ξεκίνησε",
        titleEn: "The route has started",
        bodyEl: `Το βαν για «${shift.title}» είναι καθ' οδόν.`,
        bodyEn: `The van for “${shift.title}” is on the way.`,
        data: { shiftId: shift.id },
      });
    }
    const seats = await seatMap([shift.id]);
    res.json({ shift: toShift(updated, seats.get(shift.id) ?? 0) });
  }),
);

driverRouter.post(
  "/driver/shifts/:id/complete",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const shift = await prisma.shift.findUnique({ where: { id: String(req.params.id) } });
    if (!shift || shift.driverId !== auth.id) throw new HttpError(404, "NOT_ASSIGNED");
    const decision = evaluateComplete(shift.status);
    if (!decision.ok) throw new HttpError(409, decision.code);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { shiftId: shift.id, status: "CONFIRMED" },
        data: { status: "COMPLETED" },
      });
      return tx.shift.update({
        where: { id: shift.id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: shiftInclude,
      });
    });
    const io = req.app.get("io") as Server | undefined;
    io?.to(`shift:${shift.id}`).emit("shift:status", { shiftId: shift.id, status: "COMPLETED" });
    const seats = await seatMap([shift.id]);
    res.json({ shift: toShift(updated, seats.get(shift.id) ?? 0) });
  }),
);

driverRouter.post(
  "/driver/shifts/:id/location",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z
      .object({
        lat: z.number(),
        lng: z.number(),
        heading: z.number().optional(),
        speed: z.number().optional(),
      })
      .parse(req.body);
    if (!isValidLatLng(body.lat, body.lng)) throw new HttpError(400, "BAD_INPUT");
    const io = req.app.get("io") as Server | undefined;
    const result = await recordLocation(io, {
      shiftId: String(req.params.id),
      driverId: auth.id,
      lat: body.lat,
      lng: body.lng,
      heading: body.heading,
      speed: body.speed,
    });
    if (!result.ok) throw new HttpError(409, result.code);
    res.json(result);
  }),
);

driverRouter.post(
  "/driver/shifts/:id/simulate",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z.object({ bookingId: z.string().optional() }).parse(req.body ?? {});
    const shift = await prisma.shift.findUnique({
      where: { id: String(req.params.id) },
      include: { bookings: { where: { status: "CONFIRMED" } } },
    });
    if (!shift || shift.driverId !== auth.id) throw new HttpError(404, "NOT_ASSIGNED");
    if (shift.status !== "IN_PROGRESS") throw new HttpError(409, "CANNOT_START");
    const booking = body.bookingId
      ? shift.bookings.find((row) => row.id === body.bookingId)
      : shift.bookings[0];
    if (!booking) throw new HttpError(404, "BOOKING_NOT_FOUND");
    const point = demoApproach({ lat: booking.pickupLat, lng: booking.pickupLng });
    const io = req.app.get("io") as Server | undefined;
    const result = await recordLocation(io, {
      shiftId: shift.id,
      driverId: auth.id,
      lat: point.lat,
      lng: point.lng,
      force: true,
    });
    if (!result.ok) throw new HttpError(409, result.code);
    res.json(result);
  }),
);

driverRouter.post(
  "/driver/shifts/:id/bookings/:bookingId/no-show",
  requireAuth("DRIVER"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const shift = await prisma.shift.findUnique({ where: { id: String(req.params.id) } });
    if (!shift || shift.driverId !== auth.id) throw new HttpError(404, "NOT_ASSIGNED");
    if (shift.status !== "IN_PROGRESS") throw new HttpError(409, "CANNOT_START");
    const booking = await prisma.booking.findFirst({
      where: { id: String(req.params.bookingId), shiftId: shift.id, status: "CONFIRMED" },
    });
    if (!booking) throw new HttpError(404, "BOOKING_NOT_FOUND");
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "NO_SHOW" },
    });
    res.json({ booking: { id: updated.id, status: updated.status } });
  }),
);
