import { Router } from "express";
import { z } from "zod";
import { checkPassword, hashPassword, publicUser, requireAuth, signToken, type AuthedRequest } from "../auth";
import { makeInviteCode } from "../codes";
import { HttpError, wrap } from "../http";
import { prisma } from "../prisma";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  locale: z.enum(["el", "en"]).optional(),
  role: z.enum(["BUSINESS_OWNER", "DRIVER", "EMPLOYEE"]),
  inviteCode: z.string().trim().optional().or(z.literal("")),
  business: z
    .object({
      name: z.string().trim().min(2).max(120),
      taxId: z.string().trim().max(20).optional().or(z.literal("")),
      address: z.string().trim().min(3).max(200),
      lat: z.number().gte(-90).lte(90),
      lng: z.number().gte(-180).lte(180),
    })
    .optional(),
});

authRouter.post(
  "/auth/register",
  wrap(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "EMAIL_TAKEN");
    const passwordHash = await hashPassword(body.password);
    const phone = body.phone ? body.phone : null;
    const locale = body.locale ?? "el";

    if (body.role === "BUSINESS_OWNER") {
      if (!body.business) throw new HttpError(400, "BAD_INPUT");
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: body.name,
            phone,
            locale,
            role: "BUSINESS_OWNER",
            ownedBusiness: {
              create: {
                name: body.business!.name,
                taxId: body.business!.taxId || null,
                address: body.business!.address,
                lat: body.business!.lat,
                lng: body.business!.lng,
                inviteCode: makeInviteCode(),
                status: "PENDING",
              },
            },
          },
          include: { ownedBusiness: true },
        });
        return tx.user.update({
          where: { id: created.id },
          data: { businessId: created.ownedBusiness!.id },
        });
      });
      res.status(201).json({ token: signToken(user), user: publicUser(user) });
      return;
    }

    if (body.role === "EMPLOYEE") {
      const code = (body.inviteCode ?? "").toUpperCase();
      const business = await prisma.business.findUnique({ where: { inviteCode: code } });
      if (!business) throw new HttpError(400, "INVITE_INVALID");
      if (business.status !== "APPROVED") throw new HttpError(400, "BUSINESS_PENDING");
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: body.name,
          phone,
          locale,
          role: "EMPLOYEE",
          businessId: business.id,
        },
      });
      res.status(201).json({ token: signToken(user), user: publicUser(user) });
      return;
    }

    const user = await prisma.user.create({
      data: { email, passwordHash, name: body.name, phone, locale, role: "DRIVER" },
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

authRouter.post(
  "/auth/login",
  wrap(async (req, res) => {
    const body = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await checkPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS");
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

authRouter.get(
  "/auth/me",
  requireAuth(),
  wrap(async (req, res) => {
    const auth = (req as AuthedRequest).auth;
    const user = await prisma.user.findUnique({ where: { id: auth.id } });
    if (!user) throw new HttpError(401, "UNAUTHENTICATED");
    res.json({ user: publicUser(user) });
  }),
);
