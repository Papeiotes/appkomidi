import { isValidLatLng } from "@vardia/shared";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { cancelBooking, createBooking } from "../bookingService";
import { HttpError, wrap } from "../http";
import { notify } from "../notify";
import { prisma } from "../prisma";
import { routeForShift } from "../routing";
import { canWatch, defaultPoint, seatMap, shiftInclude, syncLock, toShift } from "../shiftView";

export const ridesRouter = Router();

ridesRouter.get(
  "/shifts/available",
  requireAuth("EMPLOYEE"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    if (!auth.businessId) throw new HttpError(403, "FORBIDDEN");
    const shifts = await prisma.shift.findMany({
      where: {
        businessId: auth.businessId,
        status: { in: ["OPEN", "LOCKED", "IN_PROGRESS"] },
        departsAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      },
      include: shiftInclude,
      orderBy: { departsAt: "asc" },
      take: 50,
    });
    const synced = await Promise.all(shifts.map((shift) => syncLock(shift)));
    const seats = await seatMap(synced.map((shift) => shift.id));
    const mine = await prisma.booking.findMany({
      where: { userId: auth.id, shiftId: { in: synced.map((shift) => shift.id) }, status: "CONFIRMED" },
    });
    const mineByShift = new Map(mine.map((booking) => [booking.shiftId, booking]));
    res.json({
      shifts: synced.map((shift) => ({
        ...toShift(shift, seats.get(shift.id) ?? 0),
        myBooking: mineByShift.get(shift.id)
          ? {
              id: mineByShift.get(shift.id)!.id,
              seats: mineByShift.get(shift.id)!.seats,
              pickup: {
                lat: mineByShift.get(shift.id)!.pickupLat,
                lng: mineByShift.get(shift.id)!.pickupLng,
                label: mineByShift.get(shift.id)!.pickupLabel,
              },
            }
          : null,
      })),
    });
  }),
);

ridesRouter.get(
  "/bookings/mine",
  requireAuth("EMPLOYEE"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const bookings = await prisma.booking.findMany({
      where: { userId: auth.id },
      include: { shift: { include: shiftInclude } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const seats = await seatMap(bookings.map((booking) => booking.shiftId));
    res.json({
      bookings: bookings.map((booking) => ({
        id: booking.id,
        seats: booking.seats,
        status: booking.status,
        pickup: { lat: booking.pickupLat, lng: booking.pickupLng, label: booking.pickupLabel },
        createdAt: booking.createdAt.toISOString(),
        shift: toShift(booking.shift, seats.get(booking.shiftId) ?? 0),
      })),
    });
  }),
);

ridesRouter.post(
  "/bookings",
  requireAuth("EMPLOYEE"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z
      .object({
        shiftId: z.string().min(1),
        seats: z.number().int().optional(),
        pickupLat: z.number().optional(),
        pickupLng: z.number().optional(),
        pickupLabel: z.string().max(160).optional(),
      })
      .parse(req.body);
    const shift = await prisma.shift.findUnique({ where: { id: body.shiftId }, include: shiftInclude });
    if (!shift || shift.businessId !== auth.businessId) throw new HttpError(404, "SHIFT_NOT_FOUND");
    const fallback = defaultPoint(shift);
    const pickupLat = body.pickupLat ?? fallback.lat;
    const pickupLng = body.pickupLng ?? fallback.lng;
    const pickupLabel = body.pickupLabel?.trim() || fallback.label;
    if (!isValidLatLng(pickupLat, pickupLng)) throw new HttpError(400, "BAD_INPUT");
    const result = await createBooking({
      shiftId: shift.id,
      userId: auth.id,
      seats: body.seats ?? 1,
      pickupLat,
      pickupLng,
      pickupLabel,
    });
    const io = req.app.get("io") as Server | undefined;
    await notify(io, {
      userId: auth.id,
      type: "BOOKING_CONFIRMED",
      titleEl: "Η θέση κλείστηκε",
      titleEn: "Seat booked",
      bodyEl: `${result.booking.seats} θέση/εις στη «${shift.title}».`,
      bodyEn: `${result.booking.seats} seat(s) on “${shift.title}”.`,
      data: { shiftId: shift.id, bookingId: result.booking.id },
    });
    const owner = await prisma.business.findUnique({ where: { id: shift.businessId }, select: { ownerId: true } });
    if (owner) {
      await notify(io, {
        userId: owner.ownerId,
        type: "BOOKING_RECEIVED",
        titleEl: "Νέα κράτηση",
        titleEn: "New booking",
        bodyEl: `${auth.name} έκλεισε ${result.booking.seats} θέση/εις στη «${shift.title}».`,
        bodyEn: `${auth.name} booked ${result.booking.seats} seat(s) on “${shift.title}”.`,
        data: { shiftId: shift.id, bookingId: result.booking.id },
      });
    }
    res.status(201).json({
      booking: {
        id: result.booking.id,
        seats: result.booking.seats,
        status: result.booking.status,
        pickup: { lat: pickupLat, lng: pickupLng, label: pickupLabel },
      },
      remainingSeats: result.remainingAfter,
    });
  }),
);

ridesRouter.post(
  "/bookings/:id/cancel",
  requireAuth("EMPLOYEE"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const booking = await cancelBooking({ bookingId: String(req.params.id), userId: auth.id });
    res.json({ booking: { id: booking.id, status: booking.status } });
  }),
);

ridesRouter.get(
  "/shifts/:id",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const shift = await canWatch(auth, String(req.params.id));
    if (!shift) throw new HttpError(404, "SHIFT_NOT_FOUND");
    const seats = await seatMap([shift.id]);
    const bookings = await prisma.booking.findMany({
      where: { shiftId: shift.id },
      include: { user: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    const reveal =
      auth.role === "ADMIN" || auth.role === "BUSINESS_OWNER" || auth.role === "DRIVER";
    const visible = reveal ? bookings : bookings.filter((booking) => booking.userId === auth.id);
    const arrival = await prisma.arrivalEvent.findUnique({
      where: { shiftId_userId: { shiftId: shift.id, userId: auth.id } },
    });
    res.json({
      shift: toShift(shift, seats.get(shift.id) ?? 0),
      arrived: Boolean(arrival),
      bookings: visible.map((booking) => ({
        id: booking.id,
        seats: booking.seats,
        status: booking.status,
        pickup: { lat: booking.pickupLat, lng: booking.pickupLng, label: booking.pickupLabel },
        rider: reveal ? booking.user : { id: booking.user.id, name: booking.user.name },
      })),
    });
  }),
);

ridesRouter.get(
  "/shifts/:id/route",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const shift = await canWatch(auth, String(req.params.id));
    if (!shift) throw new HttpError(404, "SHIFT_NOT_FOUND");
    const lat = req.query.lat == null ? shift.lastLat : Number(req.query.lat);
    const lng = req.query.lng == null ? shift.lastLng : Number(req.query.lng);
    const driver =
      lat != null && lng != null && isValidLatLng(lat, lng) ? { lat, lng } : null;
    const route = await routeForShift(shift.id, driver);
    res.json({ route });
  }),
);
