import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { requireAuth, requirePermission, type AuthedRequest } from "../auth";
import { cancelBooking, moveBooking } from "../bookingService";
import { wrap } from "../http";
import { notify } from "../notify";
import { prisma } from "../prisma";

export const officeRouter = Router();

officeRouter.get(
  "/office/bookings",
  requireAuth("OFFICE", "ADMIN"),
  requirePermission("bookings.view"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const where = {
      municipalityId: auth.municipalityId,
      binType: typeof req.query.binType === "string" ? (req.query.binType as "GREEN" | "BLUE" | "YELLOW" | "BROWN") : undefined,
      status: typeof req.query.status === "string" ? (req.query.status as "CONFIRMED" | "CANCELLED" | "COMPLETED") : undefined,
      businessId: typeof req.query.businessId === "string" ? req.query.businessId : undefined,
      shift: {
        driverId: typeof req.query.driverId === "string" ? req.query.driverId : undefined,
      },
      business: typeof req.query.subAreaId === "string" ? { subAreaId: req.query.subAreaId } : undefined,
      scheduledAt:
        typeof req.query.day === "string"
          ? { gte: new Date(`${req.query.day}T00:00:00.000Z`), lt: new Date(new Date(`${req.query.day}T00:00:00.000Z`).getTime() + 86400000) }
          : undefined,
    };
    const bookings = await prisma.booking.findMany({
      where,
      include: { business: { include: { subArea: true } }, shift: { include: { driver: true, truck: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    });
    res.json({ bookings });
  }),
);

officeRouter.post(
  "/office/bookings/:id/cancel",
  requireAuth("OFFICE", "ADMIN"),
  requirePermission("bookings.cancel"),
  wrap(async (req, res) => {
    const booking = await cancelBooking({ bookingId: String(req.params.id), force: true });
    const business = await prisma.business.findUnique({ where: { id: booking.businessId } });
    const io = req.app.get("io") as Server | undefined;
    if (business) {
      await notify(io, {
        userId: business.userId,
        type: "BOOKING_CANCELLED",
        titleEl: "Το ραντεβού ακυρώθηκε",
        titleEn: "Pickup cancelled",
        bodyEl: "Το γραφείο ακύρωσε το ραντεβού.",
        bodyEn: "The office cancelled the pickup.",
        data: { bookingId: booking.id },
      });
    }
    res.json({ booking });
  }),
);

officeRouter.post(
  "/office/bookings/:id/move",
  requireAuth("OFFICE", "ADMIN"),
  requirePermission("bookings.reschedule"),
  wrap(async (req, res) => {
    const body = z.object({ scheduledAt: z.string() }).parse(req.body);
    const booking = await moveBooking({ bookingId: String(req.params.id), scheduledAt: new Date(body.scheduledAt) });
    const business = await prisma.business.findUnique({ where: { id: booking.businessId } });
    const io = req.app.get("io") as Server | undefined;
    if (business) {
      await notify(io, {
        userId: business.userId,
        type: "BOOKING_CHANGED",
        titleEl: "Άλλαξε η ώρα",
        titleEn: "Time changed",
        bodyEl: "Το γραφείο άλλαξε την ώρα του ραντεβού.",
        bodyEn: "The office changed the pickup time.",
        data: { bookingId: booking.id },
      });
    }
    res.json({ booking });
  }),
);

officeRouter.post(
  "/office/bookings/:id/question",
  requireAuth("OFFICE", "ADMIN"),
  requirePermission("bookings.question"),
  wrap(async (req, res) => {
    const body = z.object({ text: z.string().trim().min(1).max(500) }).parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) }, include: { business: true } });
    if (!booking) {
      res.status(404).json({ error: { code: "NOT_FOUND" } });
      return;
    }
    const io = req.app.get("io") as Server | undefined;
    const note = await notify(io, {
      userId: booking.business.userId,
      type: "OFFICE_QUESTION",
      titleEl: "Ερώτηση από το γραφείο",
      titleEn: "Question from the office",
      bodyEl: body.text,
      bodyEn: body.text,
      data: { bookingId: booking.id },
    });
    res.status(201).json({ notification: note });
  }),
);

officeRouter.post(
  "/office/shifts/:id/slots",
  requireAuth("OFFICE", "ADMIN"),
  requirePermission("slots.toggle"),
  wrap(async (req, res) => {
    const body = z.object({ slotAt: z.string(), closed: z.boolean() }).parse(req.body);
    const slotAt = new Date(body.slotAt);
    if (body.closed) {
      await prisma.slotClosure.upsert({
        where: { shiftId_slotAt: { shiftId: String(req.params.id), slotAt } },
        update: {},
        create: { shiftId: String(req.params.id), slotAt },
      });
    } else {
      await prisma.slotClosure.deleteMany({ where: { shiftId: String(req.params.id), slotAt } });
    }
    res.json({ ok: true });
  }),
);
