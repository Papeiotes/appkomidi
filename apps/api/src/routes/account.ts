import { Router } from "express";
import { z } from "zod";
import { checkPassword, hashPassword, publicUser, requireAuth, type AuthedRequest } from "../auth";
import { HttpError, wrap } from "../http";
import { prisma } from "../prisma";

export const accountRouter = Router();

accountRouter.patch(
  "/account",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        phone: z.string().trim().max(30).optional().or(z.literal("")),
        locale: z.enum(["el", "en"]).optional(),
        pushToken: z.string().min(10).max(200).optional(),
      })
      .parse(req.body);
    const user = await prisma.user.update({
      where: { id: auth.id },
      data: {
        name: body.name,
        phone: body.phone === "" ? null : body.phone,
        locale: body.locale,
        pushToken: body.pushToken,
      },
    });
    res.json({
      user: publicUser({
        id: user.id,
        role: user.role,
        username: user.username,
        name: user.name,
        locale: user.locale,
        phone: user.phone,
        municipalityId: user.municipalityId,
        permissions: user.permissions,
      }),
    });
  }),
);

accountRouter.post(
  "/account/password",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const body = z
      .object({ current: z.string().min(1), next: z.string().min(8).max(72) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: auth.id } });
    if (!user || !(await checkPassword(body.current, user.passwordHash))) {
      throw new HttpError(400, "WRONG_PASSWORD");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.next) },
    });
    res.json({ ok: true });
  }),
);

accountRouter.get(
  "/notifications",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const items = await prisma.notification.findMany({
      where: { userId: auth.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({
      unread: items.filter((item) => !item.readAt).length,
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        titleEl: item.titleEl,
        titleEn: item.titleEn,
        bodyEl: item.bodyEl,
        bodyEn: item.bodyEn,
        data: item.data,
        readAt: item.readAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  }),
);

accountRouter.post(
  "/notifications/:id/read",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const row = await prisma.notification.findFirst({
      where: { id: String(req.params.id), userId: auth.id },
    });
    if (!row) throw new HttpError(404, "BOOKING_NOT_FOUND");
    const updated = await prisma.notification.update({
      where: { id: row.id },
      data: { readAt: row.readAt ?? new Date() },
    });
    res.json({ id: updated.id, readAt: updated.readAt?.toISOString() ?? null });
  }),
);

accountRouter.post(
  "/notifications/read-all",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    await prisma.notification.updateMany({
      where: { userId: auth.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
