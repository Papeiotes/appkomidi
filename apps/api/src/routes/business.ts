import { assertShiftCapacity } from "@vardia/shared";
import type { Prisma, ShiftStatus } from "@prisma/client";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { HttpError, wrap } from "../http";
import { notify } from "../notify";
import { prisma } from "../prisma";
import { seatMap, shiftInclude, syncLock, toShift } from "../shiftView";

export const businessRouter = Router();

function owner(req: AuthedRequest) {
  return req.auth;
}

async function myBusiness(userId: string) {
  const business = await prisma.business.findUnique({ where: { ownerId: userId } });
  if (!business) throw new HttpError(404, "SHIFT_NOT_FOUND");
  return business;
}

const point = {
  musterLat: z.number().gte(-90).lte(90),
  musterLng: z.number().gte(-180).lte(180),
  musterLabel: z.string().trim().min(1).max(160),
  destLat: z.number().gte(-90).lte(90),
  destLng: z.number().gte(-180).lte(180),
  destLabel: z.string().trim().min(1).max(160),
};

const shiftBody = z.object({
  title: z.string().trim().min(2).max(80),
  direction: z.enum(["TO_WORK", "FROM_WORK"]),
  departsAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  capacity: z.number().int(),
  lockMinutes: z.number().int().min(0).max(24 * 60).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
  driverEmail: z.string().optional().or(z.literal("")),
  vehicleId: z.string().optional().or(z.literal("")),
  publish: z.boolean().optional(),
  ...point,
});

async function resolveDriver(email?: string) {
  if (!email) return null;
  const driver = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!driver || driver.role !== "DRIVER") throw new HttpError(400, "DRIVER_NOT_FOUND");
  return driver;
}

async function resolveVehicle(businessId: string, vehicleId?: string) {
  if (!vehicleId) return null;
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, businessId } });
  if (!vehicle) throw new HttpError(400, "BAD_INPUT");
  return vehicle;
}

businessRouter.get(
  "/business",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    res.json({ business });
  }),
);

businessRouter.patch(
  "/business",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const body = z
      .object({
        name: z.string().trim().min(2).max(120).optional(),
        taxId: z.string().trim().max(20).optional().or(z.literal("")),
        address: z.string().trim().min(3).max(200).optional(),
        lat: z.number().gte(-90).lte(90).optional(),
        lng: z.number().gte(-180).lte(180).optional(),
        resubmit: z.boolean().optional(),
      })
      .parse(req.body);
    const data: Prisma.BusinessUpdateInput = {
      name: body.name,
      address: body.address,
      lat: body.lat,
      lng: body.lng,
      taxId: body.taxId === "" ? null : body.taxId,
    };
    if (body.resubmit || business.status === "REJECTED") {
      data.status = "PENDING";
      data.rejectionNote = null;
    }
    const updated = await prisma.business.update({ where: { id: business.id }, data });
    res.json({ business: updated });
  }),
);

businessRouter.get(
  "/business/vehicles",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const vehicles = await prisma.vehicle.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ vehicles });
  }),
);

businessRouter.post(
  "/business/vehicles",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    if (business.status !== "APPROVED") throw new HttpError(403, "BUSINESS_NOT_APPROVED");
    const body = z
      .object({
        plate: z.string().trim().min(2).max(16),
        seats: z.number().int().min(1).max(60),
        label: z.string().trim().max(40).optional().or(z.literal("")),
      })
      .parse(req.body);
    const vehicle = await prisma.vehicle.create({
      data: {
        businessId: business.id,
        plate: body.plate.toUpperCase(),
        seats: body.seats,
        label: body.label || null,
      },
    });
    res.status(201).json({ vehicle });
  }),
);

businessRouter.delete(
  "/business/vehicles/:id",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: String(req.params.id), businessId: business.id },
      include: { _count: { select: { shifts: true } } },
    });
    if (!vehicle) throw new HttpError(404, "SHIFT_NOT_FOUND");
    if (vehicle._count.shifts > 0) throw new HttpError(409, "VEHICLE_IN_USE");
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
    res.json({ ok: true });
  }),
);

businessRouter.get(
  "/business/drivers",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) {
      res.json({ driver: null });
      return;
    }
    const driver = await prisma.user.findUnique({ where: { email } });
    if (!driver || driver.role !== "DRIVER") {
      res.json({ driver: null });
      return;
    }
    res.json({ driver: { id: driver.id, name: driver.name, email: driver.email } });
  }),
);

async function writeShift(
  businessId: string,
  body: z.infer<typeof shiftBody>,
  shiftId?: string,
  currentStatus?: ShiftStatus,
) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || business.status !== "APPROVED") throw new HttpError(403, "BUSINESS_NOT_APPROVED");
  const driver = await resolveDriver(body.driverEmail || undefined);
  const vehicle = await resolveVehicle(businessId, body.vehicleId || undefined);
  const capacity = assertShiftCapacity(body.capacity, vehicle?.seats ?? null);
  if (!capacity.ok) throw new HttpError(400, capacity.code);
  const departsAt = new Date(body.departsAt);
  if (body.publish && departsAt.getTime() <= Date.now()) throw new HttpError(400, "BAD_INPUT");
  const status: ShiftStatus | undefined = shiftId
    ? body.publish
      ? "OPEN"
      : currentStatus
    : body.publish
      ? "OPEN"
      : "DRAFT";
  const data = {
    title: body.title,
    direction: body.direction,
    departsAt,
    capacity: body.capacity,
    lockMinutes: body.lockMinutes ?? 30,
    notes: body.notes || null,
    driverId: driver?.id ?? null,
    vehicleId: vehicle?.id ?? null,
    musterLat: body.musterLat,
    musterLng: body.musterLng,
    musterLabel: body.musterLabel,
    destLat: body.destLat,
    destLng: body.destLng,
    destLabel: body.destLabel,
    status,
  };
  const shift = shiftId
    ? await prisma.shift.update({ where: { id: shiftId }, data, include: shiftInclude })
    : await prisma.shift.create({ data: { ...data, businessId, status: status ?? "DRAFT" }, include: shiftInclude });
  return shift;
}

businessRouter.get(
  "/business/shifts",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const shifts = await prisma.shift.findMany({
      where: { businessId: business.id },
      include: shiftInclude,
      orderBy: { departsAt: "asc" },
      take: 100,
    });
    const synced = await Promise.all(shifts.map((shift) => syncLock(shift)));
    const seats = await seatMap(synced.map((shift) => shift.id));
    res.json({ shifts: synced.map((shift) => toShift(shift, seats.get(shift.id) ?? 0)) });
  }),
);

businessRouter.post(
  "/business/shifts",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const body = shiftBody.parse(req.body);
    const shift = await writeShift(business.id, body);
    const seats = await seatMap([shift.id]);
    res.status(201).json({ shift: toShift(shift, seats.get(shift.id) ?? 0) });
  }),
);

businessRouter.patch(
  "/business/shifts/:id",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const current = await prisma.shift.findFirst({
      where: { id: String(req.params.id), businessId: business.id },
    });
    if (!current) throw new HttpError(404, "SHIFT_NOT_FOUND");
    if (current.status === "IN_PROGRESS" || current.status === "COMPLETED") {
      throw new HttpError(409, "SHIFT_NOT_CANCELLABLE");
    }
    const body = shiftBody.parse(req.body);
    const shift = await writeShift(business.id, body, current.id, current.status);
    const seats = await seatMap([shift.id]);
    res.json({ shift: toShift(shift, seats.get(shift.id) ?? 0) });
  }),
);

businessRouter.post(
  "/business/shifts/:id/publish",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const current = await prisma.shift.findFirst({
      where: { id: String(req.params.id), businessId: business.id },
      include: shiftInclude,
    });
    if (!current) throw new HttpError(404, "SHIFT_NOT_FOUND");
    if (current.status !== "DRAFT" && current.status !== "LOCKED") throw new HttpError(409, "SHIFT_NOT_OPEN");
    if (current.departsAt.getTime() <= Date.now()) throw new HttpError(400, "BAD_INPUT");
    const vehicle = current.vehicleId
      ? await prisma.vehicle.findUnique({ where: { id: current.vehicleId } })
      : null;
    const capacity = assertShiftCapacity(current.capacity, vehicle?.seats ?? null);
    if (!capacity.ok) throw new HttpError(400, capacity.code);
    const shift = await prisma.shift.update({
      where: { id: current.id },
      data: { status: "OPEN" },
      include: shiftInclude,
    });
    const seats = await seatMap([shift.id]);
    res.json({ shift: toShift(shift, seats.get(shift.id) ?? 0) });
  }),
);

businessRouter.post(
  "/business/shifts/:id/duplicate",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const current = await prisma.shift.findFirst({
      where: { id: String(req.params.id), businessId: business.id },
    });
    if (!current) throw new HttpError(404, "SHIFT_NOT_FOUND");
    const body = z.object({ departsAt: z.string() }).parse(req.body);
    const departsAt = new Date(body.departsAt);
    if (Number.isNaN(departsAt.getTime())) throw new HttpError(400, "BAD_INPUT");
    const shift = await prisma.shift.create({
      data: {
        businessId: business.id,
        driverId: current.driverId,
        vehicleId: current.vehicleId,
        title: current.title,
        direction: current.direction,
        departsAt,
        capacity: current.capacity,
        lockMinutes: current.lockMinutes,
        notes: current.notes,
        musterLat: current.musterLat,
        musterLng: current.musterLng,
        musterLabel: current.musterLabel,
        destLat: current.destLat,
        destLng: current.destLng,
        destLabel: current.destLabel,
        status: "DRAFT",
      },
      include: shiftInclude,
    });
    res.status(201).json({ shift: toShift(shift, 0) });
  }),
);

businessRouter.post(
  "/business/shifts/:id/cancel",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const auth = owner(req as AuthedRequest);
    const business = await myBusiness(auth.id);
    const current = await prisma.shift.findFirst({
      where: { id: String(req.params.id), businessId: business.id },
      include: { bookings: { where: { status: "CONFIRMED" } } },
    });
    if (!current) throw new HttpError(404, "SHIFT_NOT_FOUND");
    if (current.status === "IN_PROGRESS" || current.status === "COMPLETED" || current.status === "CANCELLED") {
      throw new HttpError(409, "SHIFT_NOT_CANCELLABLE");
    }
    await prisma.$transaction([
      prisma.shift.update({ where: { id: current.id }, data: { status: "CANCELLED" } }),
      prisma.booking.updateMany({
        where: { shiftId: current.id, status: "CONFIRMED" },
        data: { status: "CANCELLED" },
      }),
    ]);
    const io = req.app.get("io") as Server | undefined;
    const targets = new Set(current.bookings.map((booking) => booking.userId));
    if (current.driverId) targets.add(current.driverId);
    for (const userId of targets) {
      await notify(io, {
        userId,
        type: "SHIFT_CANCELLED",
        titleEl: "Η βάρδια ακυρώθηκε",
        titleEn: "Shift cancelled",
        bodyEl: `Η «${current.title}» δεν θα γίνει.`,
        bodyEn: `“${current.title}” will not run.`,
        data: { shiftId: current.id },
      });
    }
    res.json({ ok: true });
  }),
);

businessRouter.get(
  "/business/shifts/:id",
  requireAuth("BUSINESS_OWNER"),
  wrap(async (req, res) => {
    const business = await myBusiness(owner(req as AuthedRequest).id);
    const shift = await prisma.shift.findFirst({
      where: { id: String(req.params.id), businessId: business.id },
      include: {
        ...shiftInclude,
        bookings: { include: { user: { select: { id: true, name: true, phone: true, email: true } } }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!shift) throw new HttpError(404, "SHIFT_NOT_FOUND");
    const synced = await syncLock(shift);
    const confirmed = shift.bookings.filter((booking) => booking.status === "CONFIRMED").reduce((sum, booking) => sum + booking.seats, 0);
    res.json({
      shift: toShift(synced, confirmed),
      bookings: shift.bookings.map((booking) => ({
        id: booking.id,
        seats: booking.seats,
        status: booking.status,
        pickup: { lat: booking.pickupLat, lng: booking.pickupLng, label: booking.pickupLabel },
        rider: booking.user,
        createdAt: booking.createdAt.toISOString(),
      })),
    });
  }),
);
