import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { requireAuth } from "../auth";
import { HttpError, wrap } from "../http";
import { notify } from "../notify";
import { prisma } from "../prisma";
import { seatMap, shiftInclude, toShift } from "../shiftView";

export const adminRouter = Router();

adminRouter.get(
  "/admin/stats",
  requireAuth("ADMIN"),
  wrap(async (_req, res) => {
    const [pendingBusinesses, openShifts, liveShifts] = await Promise.all([
      prisma.business.count({ where: { status: "PENDING" } }),
      prisma.shift.count({ where: { status: "OPEN" } }),
      prisma.shift.count({ where: { status: "IN_PROGRESS" } }),
    ]);
    res.json({ pendingBusinesses, openShifts, liveShifts });
  }),
);

adminRouter.get(
  "/admin/businesses",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const status = z.enum(["PENDING", "APPROVED", "REJECTED"]).optional().parse(req.query.status);
    const businesses = await prisma.business.findMany({
      where: status ? { status } : undefined,
      include: { owner: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ businesses });
  }),
);

adminRouter.post(
  "/admin/businesses/:id/approve",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const business = await prisma.business.findUnique({ where: { id: String(req.params.id) } });
    if (!business) throw new HttpError(404, "SHIFT_NOT_FOUND");
    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { status: "APPROVED", rejectionNote: null },
    });
    const io = req.app.get("io") as Server | undefined;
    await notify(io, {
      userId: business.ownerId,
      type: "BUSINESS_APPROVED",
      titleEl: "Η επιχείρηση εγκρίθηκε",
      titleEn: "Business approved",
      bodyEl: `Η «${business.name}» μπορεί να ανοίξει βάρδιες. Κωδικός εργαζομένων: ${business.inviteCode}.`,
      bodyEn: `“${business.name}” can open shifts. Employee code: ${business.inviteCode}.`,
      data: { businessId: business.id },
    });
    res.json({ business: updated });
  }),
);

adminRouter.post(
  "/admin/businesses/:id/reject",
  requireAuth("ADMIN"),
  wrap(async (req, res) => {
    const body = z.object({ note: z.string().trim().max(300).optional() }).parse(req.body ?? {});
    const business = await prisma.business.findUnique({ where: { id: String(req.params.id) } });
    if (!business) throw new HttpError(404, "SHIFT_NOT_FOUND");
    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { status: "REJECTED", rejectionNote: body.note || null },
    });
    const io = req.app.get("io") as Server | undefined;
    await notify(io, {
      userId: business.ownerId,
      type: "BUSINESS_REJECTED",
      titleEl: "Η αίτηση απορρίφθηκε",
      titleEn: "Application rejected",
      bodyEl: body.note ? body.note : `Η «${business.name}» δεν εγκρίθηκε. Μπορείς να στείλεις ξανά την έδρα.`,
      bodyEn: body.note ? body.note : `“${business.name}” was not approved. You can send the workplace again.`,
      data: { businessId: business.id },
    });
    res.json({ business: updated });
  }),
);

adminRouter.get(
  "/admin/live",
  requireAuth("ADMIN"),
  wrap(async (_req, res) => {
    const shifts = await prisma.shift.findMany({
      where: { status: "IN_PROGRESS" },
      include: shiftInclude,
      orderBy: { startedAt: "desc" },
      take: 30,
    });
    const seats = await seatMap(shifts.map((shift) => shift.id));
    res.json({ shifts: shifts.map((shift) => toShift(shift, seats.get(shift.id) ?? 0)) });
  }),
);
