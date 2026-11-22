import type { Role } from "@prisma/client";
import { OFFICE_PERMISSIONS, type OfficePermission } from "@vardia/shared";
import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env";
import { HttpError, wrap } from "./http";
import { prisma } from "./prisma";

export interface AuthUser {
  id: string;
  role: Role;
  username: string;
  name: string;
  locale: string;
  phone: string | null;
  municipalityId: string;
  permissions: string[];
}

export interface AuthedRequest extends Request {
  auth: AuthUser;
}

export function signToken(user: { id: string; role: Role; municipalityId: string }) {
  return jwt.sign({ sub: user.id, role: user.role, municipalityId: user.municipalityId }, env.jwtSecret, {
    expiresIn: "7d",
  });
}

export function publicUser(user: AuthUser & { businessId?: string | null }) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    phone: user.phone,
    role: user.role,
    locale: user.locale,
    municipalityId: user.municipalityId,
    permissions: user.permissions,
    businessId: user.businessId ?? null,
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
    const user = await prisma.user.findUnique({ where: { id: sub }, include: { business: { select: { id: true } } } });
    if (!user) throw new HttpError(401, "UNAUTHENTICATED");
    if (roles.length > 0 && !roles.includes(user.role)) throw new HttpError(403, "FORBIDDEN");
    (req as AuthedRequest).auth = {
      id: user.id,
      role: user.role,
      username: user.username,
      name: user.name,
      locale: user.locale,
      phone: user.phone,
      municipalityId: user.municipalityId,
      permissions: user.permissions,
    };
    (req as AuthedRequest & { businessId?: string }).businessId = user.business?.id;
    next();
  });
}

export function requirePermission(permission: OfficePermission) {
  return wrap(async (req: Request, _res: Response, next: NextFunction) => {
    const auth = (req as AuthedRequest).auth;
    if (!auth) throw new HttpError(401, "UNAUTHENTICATED");
    if (auth.role === "ADMIN") return next();
    if (auth.role === "OFFICE" && auth.permissions.includes(permission) && OFFICE_PERMISSIONS.includes(permission)) {
      return next();
    }
    throw new HttpError(403, "FORBIDDEN");
  });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function businessIdOf(req: Request) {
  return (req as AuthedRequest & { businessId?: string }).businessId ?? null;
}
