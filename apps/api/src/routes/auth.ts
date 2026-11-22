import {
  BIN_TYPES,
  BRACKETS,
  isValidAfm,
  isValidLatLng,
  OFFICE_PERMISSIONS,
} from "@vardia/shared";
import { Router } from "express";
import { z } from "zod";
import { businessIdOf, checkPassword, hashPassword, publicUser, requireAuth, signToken, type AuthedRequest } from "../auth";
import { HttpError, wrap } from "../http";
import { prisma } from "../prisma";
import { assignSubArea } from "@vardia/shared";

export const authRouter = Router();

const username = z.string().trim().toLowerCase().min(3).max(32).regex(/^[a-z0-9._-]+$/);

authRouter.post(
  "/auth/register",
  wrap(async (req, res) => {
    const body = z
      .object({
        username,
        password: z.string().min(8).max(72),
        businessName: z.string().trim().min(2).max(120),
        afm: z.string().regex(/^\d{9}$/),
        phone: z.string().trim().min(6).max(20),
        contactName: z.string().trim().min(2).max(80),
        street: z.string().trim().min(2).max(120),
        streetNumber: z.string().trim().min(1).max(12),
        addressLabel: z.string().trim().min(3).max(200),
        lat: z.number(),
        lng: z.number(),
        locale: z.enum(["el", "en"]).optional(),
      })
      .parse(req.body);
    if (!isValidAfm(body.afm)) throw new HttpError(400, "AFM_INVALID");
    if (!isValidLatLng(body.lat, body.lng)) throw new HttpError(400, "BAD_INPUT");
    const municipality = await prisma.municipality.findUnique({ where: { slug: "default" } });
    if (!municipality) throw new HttpError(500, "REQUEST_FAILED");
    const taken = await prisma.user.findUnique({ where: { username: body.username } });
    if (taken) throw new HttpError(409, "USERNAME_TAKEN");
    const areas = await prisma.subArea.findMany({ where: { municipalityId: municipality.id } });
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
        locale: body.locale ?? "el",
        municipalityId: municipality.id,
        business: {
          create: {
            municipalityId: municipality.id,
            name: body.businessName,
            afm: body.afm,
            phone: body.phone,
            contactName: body.contactName,
            street: body.street,
            streetNumber: body.streetNumber,
            addressLabel: body.addressLabel,
            lat: body.lat,
            lng: body.lng,
            status: "PENDING",
            subAreaId,
          },
        },
      },
      include: { business: true },
    });
    res.status(201).json({
      token: signToken(user),
      user: { ...publicUser({ ...user, permissions: user.permissions }), businessId: user.business?.id ?? null },
    });
  }),
);

authRouter.post(
  "/auth/login",
  wrap(async (req, res) => {
    const body = z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { username: body.username.trim().toLowerCase() },
      include: { business: { select: { id: true } } },
    });
    if (!user || !(await checkPassword(body.password, user.passwordHash))) throw new HttpError(401, "INVALID_CREDENTIALS");
    res.json({
      token: signToken(user),
      user: { ...publicUser({ ...user, permissions: user.permissions }), businessId: user.business?.id ?? null },
    });
  }),
);

authRouter.get(
  "/auth/me",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    res.json({ user: { ...publicUser(auth), businessId: businessIdOf(req) }, bins: BIN_TYPES, brackets: BRACKETS, permissions: OFFICE_PERMISSIONS });
  }),
);
