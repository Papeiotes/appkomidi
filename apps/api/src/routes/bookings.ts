import { kgForBracket, slotInstants, suggestSlot, type BinType, type QuantityBracket } from "@vardia/shared";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { businessIdOf, requireAuth, type AuthedRequest } from "../auth";
import { cancelBooking, createBooking } from "../bookingService";
import { env } from "../env";
import { HttpError, wrap } from "../http";
import { notify } from "../notify";
import { prisma } from "../prisma";
import { haversineMeters } from "@vardia/shared";

export const bookingsRouter = Router();

function bin(value: string): BinType {
  if (value === "GREEN" || value === "BLUE" || value === "YELLOW" || value === "BROWN") return value;
  throw new HttpError(400, "BAD_INPUT");
}

bookingsRouter.get(
  "/business",
  requireAuth("BUSINESS"),
  wrap(async (req, res) => {
    const business = await prisma.business.findUnique({
      where: { id: businessIdOf(req) ?? "" },
      include: { subArea: true },
    });
    if (!business) throw new HttpError(404, "NOT_FOUND");
    res.json({ business });
  }),
);

bookingsRouter.get(
  "/slots",
  requireAuth("BUSINESS"),
  wrap(async (req, res) => {
    const business = await prisma.business.findUnique({ where: { id: businessIdOf(req) ?? "" } });
    if (!business || business.status !== "APPROVED") throw new HttpError(403, "NOT_APPROVED");
    const type = bin(String(req.query.binType ?? "GREEN"));
    const now = new Date();
    const until = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    const shifts = await prisma.shift.findMany({
      where: {
        municipalityId: business.municipalityId,
        status: "SCHEDULED",
        startsAt: { lte: until },
        endsAt: { gte: now },
        truck: { binType: type, active: true },
      },
      include: { truck: true, closures: true, bookings: { where: { status: "CONFIRMED" }, include: { business: true } } },
    });
    const map = new Map<string, { at: string; remainingKg: number; bookable: boolean }>();
    for (const shift of shifts) {
      const used = shift.bookings.reduce((sum, booking) => sum + booking.kg, 0);
      const closed = new Set(shift.closures.map((closure) => closure.slotAt.toISOString()));
      for (const instant of slotInstants(shift.startsAt, shift.endsAt)) {
        if (instant <= now || instant > until) continue;
        const key = instant.toISOString();
        const remaining = shift.truck.capacityKg - used;
        const current = map.get(key);
        const slotRemaining = closed.has(key) ? 0 : remaining;
        if (!current || slotRemaining > current.remainingKg) {
          map.set(key, { at: key, remainingKg: Math.max(0, slotRemaining), bookable: slotRemaining > 0 });
        }
      }
    }
    const slots = [...map.values()].sort((a, b) => a.at.localeCompare(b.at));
    const nearby = shifts
      .flatMap((shift) => shift.bookings)
      .filter((booking) => haversineMeters(business, { lat: booking.business.lat, lng: booking.business.lng }) < 800);
    const suggested = suggestSlot(
      slots.filter((slot) => slot.bookable).map((slot) => slot.at),
      nearby.map((booking) => booking.scheduledAt.toISOString()),
    );
    res.json({ slots, suggested, overflowKg: env.overflowKg });
  }),
);

bookingsRouter.post(
  "/bookings",
  requireAuth("BUSINESS"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z
      .object({
        items: z
          .array(
            z.object({
              binType: z.enum(["GREEN", "BLUE", "YELLOW", "BROWN"]),
              bracket: z.enum(["KG_0_10", "KG_10_20", "KG_20_50", "KG_50_PLUS"]),
              scheduledAt: z.string(),
            }),
          )
          .min(1)
          .max(4),
      })
      .parse(req.body);
    const businessId = businessIdOf(req);
    if (!businessId) throw new HttpError(403, "NOT_APPROVED");
    const results = [];
    for (const item of body.items) {
      const scheduledAt = new Date(item.scheduledAt);
      try {
        const booked = await createBooking({
          businessId,
          binType: item.binType,
          bracket: item.bracket as QuantityBracket,
          scheduledAt,
        });
        const io = req.app.get("io") as Server | undefined;
        await notify(io, {
          userId: auth.id,
          type: "BOOKING_CONFIRMED",
          titleEl: "Το ραντεβού κλείστηκε",
          titleEn: "Pickup booked",
          bodyEl: `${item.binType} · ${kgForBracket(item.bracket, env.overflowKg)} kg`,
          bodyEn: `${item.binType} · ${kgForBracket(item.bracket, env.overflowKg)} kg`,
          data: { bookingId: booked.booking.id },
        });
        results.push({ ok: true, booking: booked.booking });
      } catch (error) {
        results.push({ ok: false, code: error instanceof Error ? error.message : "REQUEST_FAILED", item });
      }
    }
    res.status(201).json({ results });
  }),
);

bookingsRouter.get(
  "/bookings/mine",
  requireAuth("BUSINESS"),
  wrap(async (req, res) => {
    const bookings = await prisma.booking.findMany({
      where: { businessId: businessIdOf(req) ?? "" },
      include: { shift: { include: { driver: { select: { name: true } }, truck: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 80,
    });
    res.json({
      bookings: bookings.map((booking) => ({
        ...booking,
        scheduledAt: booking.scheduledAt.toISOString(),
        shift: {
          id: booking.shift.id,
          status: booking.shift.status,
          driverName: booking.shift.driver.name,
          binType: booking.shift.truck.binType,
          lastLat: booking.shift.lastLat,
          lastLng: booking.shift.lastLng,
        },
      })),
    });
  }),
);

bookingsRouter.post(
  "/bookings/:id/cancel",
  requireAuth("BUSINESS"),
  wrap(async (req, res) => {
    const booking = await cancelBooking({ bookingId: String(req.params.id), businessId: businessIdOf(req) ?? "" });
    res.json({ booking });
  }),
);

bookingsRouter.get(
  "/business/stats",
  requireAuth("BUSINESS"),
  wrap(async (req, res) => {
    const rows = await prisma.booking.groupBy({
      by: ["binType", "status"],
      where: { businessId: businessIdOf(req) ?? "" },
      _sum: { kg: true },
      _count: true,
    });
    res.json({ rows });
  }),
);

bookingsRouter.get(
  "/bookings/:id/live",
  requireAuth("BUSINESS"),
  wrap(async (req, res) => {
    const booking = await prisma.booking.findFirst({
      where: { id: String(req.params.id), businessId: businessIdOf(req) ?? "" },
      include: { shift: true, business: true },
    });
    if (!booking) throw new HttpError(404, "NOT_FOUND");
    const { previewEta } = await import("../tracking");
    const preview = await previewEta(booking.shiftId, booking.id);
    res.json({
      booking: { id: booking.id, status: booking.status, arrivalOpen: booking.arrivalOpen, scheduledAt: booking.scheduledAt.toISOString() },
      shift: {
        id: booking.shift.id,
        status: booking.shift.status,
        lastLat: booking.shift.lastLat,
        lastLng: booking.shift.lastLng,
      },
      eta: preview?.eta?.toISOString() ?? null,
      leg: preview?.leg ?? null,
    });
  }),
);

bookingsRouter.post(
  "/notifications/:id/reply",
  requireAuth("BUSINESS"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z.object({ reply: z.string().trim().min(1).max(500) }).parse(req.body);
    const note = await prisma.notification.findFirst({ where: { id: String(req.params.id), userId: auth.id } });
    if (!note) throw new HttpError(404, "NOT_FOUND");
    const updated = await prisma.notification.update({
      where: { id: note.id },
      data: { reply: body.reply, repliedAt: new Date() },
    });
    res.json({ notification: updated });
  }),
);
