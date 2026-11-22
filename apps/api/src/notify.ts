import type { Prisma } from "@prisma/client";
import type { Server } from "socket.io";
import { prisma } from "./prisma";

export async function notify(
  io: Server | null | undefined,
  input: {
    userId: string;
    type: string;
    titleEl: string;
    titleEn: string;
    bodyEl: string;
    bodyEn: string;
    data?: Prisma.InputJsonValue;
  },
) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      titleEl: input.titleEl,
      titleEn: input.titleEn,
      bodyEl: input.bodyEl,
      bodyEn: input.bodyEn,
      data: input.data,
    },
  });
  io?.to(`user:${input.userId}`).emit("notification", row);
  return row;
}
