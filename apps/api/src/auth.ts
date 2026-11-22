import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env";
import { HttpError, normalizeEmail, wrap } from "./http";
import { prisma } from "./prisma";

export interface AuthUser {
  id: string;
  role: Role;
  businessId: string | null;
  email: string;
  name: string;
  locale: string;
  phone: string | null;
}

export interface AuthedRequest extends Request {
  auth: AuthUser;
}

export function signToken(user: { id: string; role: Role; businessId: string | null }) {
  return jwt.sign({ sub: user.id, role: user.role, businessId: user.businessId }, env.jwtSecret, {
    expiresIn: "7d",
  });
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  locale: string;
  businessId: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    locale: user.locale,
    businessId: user.businessId,
  };
}

export function requireAuth(...roles: Role[]) {
  return wrap(async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new HttpError(401, "UNAUTHENTICATED");
    let sub = "";
    try {
      const payload = jwt.verify(token, env.jwtSecret) as { sub?: string };
      sub = payload.sub ?? "";
    } catch {
      throw new HttpError(401, "UNAUTHENTICATED");
    }
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) throw new HttpError(401, "UNAUTHENTICATED");
    if (roles.length > 0 && !roles.includes(user.role)) throw new HttpError(403, "FORBIDDEN");
    (req as AuthedRequest).auth = {
      id: user.id,
      role: user.role,
      businessId: user.businessId,
      email: user.email,
      name: user.name,
      locale: user.locale,
      phone: user.phone,
    };
    next();
  });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function emailOf(value: string) {
  return normalizeEmail(value);
}
