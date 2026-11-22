import { assignSubArea, athensInstant, copyAthensClock, isValidAfm, isValidLatLng, shiftEndsAt, OFFICE_PERMISSIONS } from "@vardia/shared";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { hashPassword, requireAuth, type AuthedRequest } from "../auth";
import { HttpError, wrap } from "../http";
import { notify } from "../notify";
import { prisma } from "../prisma";

export const adminRouter = Router();

const username = z.string().trim().toLowerCase().min(3).max(32).regex(/^[a-z0-9._-]+$/);

adminRouter.get(
  "/admin/businesses",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const businesses = await prisma.business.findMany({
      where: { municipalityId: auth.municipalityId, status: status as "PENDING" | "APPROVED" | "REJECTED" | undefined },
      include: { user: { select: { username: true } }, subArea: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ businesses });
  }),
);

adminRouter.post(
  "/admin/businesses/:id/approve",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z
      .object({
        lat: z.number().optional(),
        lng: z.number().optional(),
        subAreaId: z.string().nullable().optional(),
      })
      .parse(req.body ?? {});
    const business = await prisma.business.findUnique({ where: { id: String(req.params.id) } });
    if (!business) throw new HttpError(404, "NOT_FOUND");
    const lat = body.lat ?? business.lat;
    const lng = body.lng ?? business.lng;
    const areas = await prisma.subArea.findMany({ where: { municipalityId: business.municipalityId } });
    const auto = assignSubArea(
      { lat, lng },
      areas.map((area) => ({ id: area.id, ring: area.ring as [number, number][] })),
    );
    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { status: "APPROVED", lat, lng, rejectionNote: null, subAreaId: body.subAreaId === undefined ? auto : body.subAreaId },
    });
    const io = req.app.get("io") as Server | undefined;
    await notify(io, {
      userId: business.userId,
      type: "ACCOUNT_APPROVED",
      titleEl: "Ο λογαριασμός εγκρίθηκε",
      titleEn: "Account approved",
      bodyEl: "Μπορείς να κλείσεις ραντεβού αποκομιδής.",
      bodyEn: "You can book pickups now.",
      data: { businessId: business.id },
    });
    res.json({ business: updated });
  }),
);

adminRouter.post(
  "/admin/businesses/:id/reject",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z.object({ note: z.string().max(300).optional() }).parse(req.body ?? {});
    const business = await prisma.business.findUnique({ where: { id: String(req.params.id) } });
    if (!business) throw new HttpError(404, "NOT_FOUND");
    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { status: "REJECTED", rejectionNote: body.note ?? null },
    });
    res.json({ business: updated });
  }),
);

adminRouter.post(
  "/admin/businesses",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z
      .object({
        username,
        password: z.string().min(8).max(72),
        businessName: z.string().trim().min(2),
        afm: z.string().regex(/^\d{9}$/),
        phone: z.string().min(6),
        contactName: z.string().min(2),
        street: z.string().min(2),
        streetNumber: z.string().min(1),
        addressLabel: z.string().min(3),
        lat: z.number(),
        lng: z.number(),
      })
      .parse(req.body);
    if (!isValidAfm(body.afm) || !isValidLatLng(body.lat, body.lng)) throw new HttpError(400, "AFM_INVALID");
    const taken = await prisma.user.findUnique({ where: { username: body.username } });
    if (taken) throw new HttpError(409, "USERNAME_TAKEN");
    const areas = await prisma.subArea.findMany({ where: { municipalityId: auth.municipalityId } });
    const subAreaId = assignSubArea(
      { lat: body.lat, lng: body.lng },
      areas.map((area) => ({ id: area.id, ring: area.ring as [number, number][] })),
    );
    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash: await hashPassword(body.password),
        role: "BUSINESS",
        name: body.contactName,
        phone: body.phone,
        municipalityId: auth.municipalityId,
        business: {
          create: {
            municipalityId: auth.municipalityId,
            name: body.businessName,
            afm: body.afm,
            phone: body.phone,
            contactName: body.contactName,
            street: body.street,
            streetNumber: body.streetNumber,
            addressLabel: body.addressLabel,
            lat: body.lat,
            lng: body.lng,
            status: "APPROVED",
            subAreaId,
          },
        },
      },
    });
    res.status(201).json({ user: { id: user.id, username: user.username } });
  }),
);

adminRouter.get(
  "/admin/users",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { municipalityId: (req as AuthedRequest).auth.municipalityId },
      select: { id: true, username: true, name: true, role: true, phone: true, permissions: true },
      orderBy: { username: "asc" },
    });
    res.json({ users });
  }),
);

adminRouter.post(
  "/admin/users",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z
      .object({
        username,
        password: z.string().min(8).max(72),
        name: z.string().trim().min(2).max(80),
        phone: z.string().optional(),
        role: z.enum(["ADMIN", "OFFICE", "DRIVER"]),
        permissions: z.array(z.enum(OFFICE_PERMISSIONS)).optional(),
        binType: z.enum(["GREEN", "BLUE", "YELLOW", "BROWN"]).optional(),
        plate: z.string().trim().min(2).max(16).optional(),
        capacityKg: z.number().int().min(10).max(20000).optional(),
      })
      .parse(req.body);
    const taken = await prisma.user.findUnique({ where: { username: body.username } });
    if (taken) throw new HttpError(409, "USERNAME_TAKEN");
    if (body.role === "DRIVER" && (!body.binType || !body.plate || !body.capacityKg)) {
      throw new HttpError(400, "BAD_INPUT");
    }
    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash: await hashPassword(body.password),
        name: body.name,
        phone: body.phone,
        role: body.role,
        municipalityId: auth.municipalityId,
        permissions: body.role === "OFFICE" ? body.permissions ?? [...OFFICE_PERMISSIONS] : [],
      },
    });
    if (body.role === "DRIVER" && body.binType && body.plate && body.capacityKg) {
      await prisma.truck.create({
        data: {
          municipalityId: auth.municipalityId,
          binType: body.binType,
          capacityKg: body.capacityKg,
          plate: body.plate.toUpperCase(),
          driverId: user.id,
        },
      });
    }
    res.status(201).json({ user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions } });
  }),
);

adminRouter.patch(
  "/admin/users/:id/permissions",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z.object({ permissions: z.array(z.enum(OFFICE_PERMISSIONS)) }).parse(req.body);
    const user = await prisma.user.update({ where: { id: String(req.params.id) }, data: { permissions: body.permissions } });
    res.json({ user: { id: user.id, permissions: user.permissions } });
  }),
);

adminRouter.post(
  "/admin/trucks",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z
      .object({
        binType: z.enum(["GREEN", "BLUE", "YELLOW", "BROWN"]),
        capacityKg: z.number().int().min(10).max(20000),
        plate: z.string().trim().min(2).max(16),
        driverId: z.string().optional(),
      })
      .parse(req.body);
    const truck = await prisma.truck.create({
      data: {
        municipalityId: (req as AuthedRequest).auth.municipalityId,
        binType: body.binType,
        capacityKg: body.capacityKg,
        plate: body.plate.toUpperCase(),
        driverId: body.driverId,
      },
    });
    res.status(201).json({ truck });
  }),
);

adminRouter.get(
  "/admin/trucks",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const trucks = await prisma.truck.findMany({ where: { municipalityId: (req as AuthedRequest).auth.municipalityId } });
    res.json({ trucks });
  }),
);

adminRouter.post(
  "/admin/shifts",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z
      .object({
        truckId: z.string(),
        driverId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        weeks: z.number().int().min(1).max(8).optional(),
      })
      .parse(req.body);
    const [hour, minute] = body.time.split(":").map(Number);
    const [year, month, day] = body.date.split("-").map(Number);
    const first = athensInstant(year, month, day, hour, minute);
    const truck = await prisma.truck.findUnique({ where: { id: body.truckId } });
    const driver = await prisma.user.findUnique({ where: { id: body.driverId } });
    if (!truck || !driver || driver.role !== "DRIVER") throw new HttpError(400, "BAD_INPUT");
    const weeks = body.weeks ?? 1;
    const shifts = [];
    for (let week = 0; week < weeks; week++) {
      const startsAt = week === 0 ? first : copyAthensClock(first, addDays(body.date, week * 7));
      shifts.push(
        await prisma.shift.create({
          data: {
            municipalityId: truck.municipalityId,
            truckId: truck.id,
            driverId: driver.id,
            startsAt,
            endsAt: shiftEndsAt(startsAt),
          },
        }),
      );
    }
    res.status(201).json({ shift: shifts[0], shifts });
  }),
);

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const civil = new Date(Date.UTC(year, month - 1, day + days));
  const m = String(civil.getUTCMonth() + 1).padStart(2, "0");
  const d = String(civil.getUTCDate()).padStart(2, "0");
  return `${civil.getUTCFullYear()}-${m}-${d}`;
}

adminRouter.patch(
  "/admin/shifts/:id",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z
      .object({
        truckId: z.string().optional(),
        driverId: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      })
      .parse(req.body);
    const shift = await prisma.shift.findUnique({ where: { id: String(req.params.id) } });
    if (!shift || shift.status !== "SCHEDULED") throw new HttpError(409, "SHIFT_STARTED");
    let startsAt = shift.startsAt;
    if (body.date && body.time) {
      const [hour, minute] = body.time.split(":").map(Number);
      const [year, month, day] = body.date.split("-").map(Number);
      startsAt = athensInstant(year, month, day, hour, minute);
    }
    const updated = await prisma.shift.update({
      where: { id: shift.id },
      data: {
        truckId: body.truckId,
        driverId: body.driverId,
        startsAt,
        endsAt: shiftEndsAt(startsAt),
      },
    });
    res.json({ shift: updated });
  }),
);

adminRouter.delete(
  "/admin/shifts/:id",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const shift = await prisma.shift.findUnique({ where: { id: String(req.params.id) } });
    if (!shift || shift.status !== "SCHEDULED") throw new HttpError(409, "SHIFT_STARTED");
    await prisma.booking.deleteMany({ where: { shiftId: shift.id } });
    await prisma.slotClosure.deleteMany({ where: { shiftId: shift.id } });
    await prisma.shift.delete({ where: { id: shift.id } });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  "/admin/shifts/copy",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z.object({ shiftId: z.string(), dates: z.array(z.string()).min(1).max(14) }).parse(req.body);
    const source = await prisma.shift.findUnique({ where: { id: body.shiftId } });
    if (!source) throw new HttpError(404, "NOT_FOUND");
    const created = [];
    for (const date of body.dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "BAD_INPUT");
      const startsAt = copyAthensClock(source.startsAt, date);
      const endsAt = shiftEndsAt(startsAt);
      created.push(
        await prisma.shift.create({
          data: { municipalityId: source.municipalityId, truckId: source.truckId, driverId: source.driverId, startsAt, endsAt },
        }),
      );
    }
    res.status(201).json({ shifts: created });
  }),
);

adminRouter.get(
  "/admin/shifts",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const shifts = await prisma.shift.findMany({
      where: { municipalityId: (req as AuthedRequest).auth.municipalityId },
      include: { truck: true, driver: { select: { id: true, name: true, username: true } } },
      orderBy: { startsAt: "asc" },
      take: 100,
    });
    res.json({ shifts });
  }),
);

adminRouter.post(
  "/admin/areas",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z.object({ name: z.string().min(2), ring: z.array(z.tuple([z.number(), z.number()])).min(3) }).parse(req.body);
    const area = await prisma.subArea.create({
      data: { municipalityId: (req as AuthedRequest).auth.municipalityId, name: body.name, ring: body.ring },
    });
    res.status(201).json({ area });
  }),
);

adminRouter.get(
  "/admin/areas",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const areas = await prisma.subArea.findMany({ where: { municipalityId: (req as AuthedRequest).auth.municipalityId } });
    res.json({ areas });
  }),
);

adminRouter.get(
  "/admin/stats",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const municipalityId = (req as AuthedRequest).auth.municipalityId;
    const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
    const rows = await prisma.booking.groupBy({
      by: ["businessId", "binType", "status"],
      where: { municipalityId, businessId },
      _sum: { kg: true },
      _count: true,
    });
    const businesses = await prisma.business.findMany({
      where: { municipalityId, id: businessId },
      select: { id: true, name: true },
    });
    res.json({ rows, businesses });
  }),
);

