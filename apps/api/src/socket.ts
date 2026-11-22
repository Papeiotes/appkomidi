import type { Role } from "@prisma/client";
import { isValidLatLng } from "@vardia/shared";
import jwt from "jsonwebtoken";
import type { Server } from "socket.io";
import { env } from "./env";
import { prisma } from "./prisma";
import { canWatch } from "./shiftView";
import { recordLocation } from "./tracking";

export function attachSocket(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("missing");
      const payload = jwt.verify(token, env.jwtSecret) as { sub?: string; role?: Role };
      if (!payload.sub) throw new Error("missing");
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.data.userId);
    socket.join(`user:${userId}`);

    socket.on("shift:join", async (shiftId: string) => {
      if (typeof shiftId !== "string") return;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;
      const shift = await canWatch(
        {
          id: user.id,
          role: user.role,
          businessId: user.businessId,
          email: user.email,
          name: user.name,
          locale: user.locale,
          phone: user.phone,
        },
        shiftId,
      );
      if (shift) socket.join(`shift:${shiftId}`);
    });

    socket.on("shift:location", async (body: { shiftId?: string; lat?: number; lng?: number; heading?: number; speed?: number }) => {
      if (socket.data.role !== "DRIVER") return;
      if (!body?.shiftId || body.lat == null || body.lng == null || !isValidLatLng(body.lat, body.lng)) return;
      await recordLocation(io, {
        shiftId: body.shiftId,
        driverId: userId,
        lat: body.lat,
        lng: body.lng,
        heading: body.heading,
        speed: body.speed,
      });
    });
  });
}
