import type { Server } from "socket.io";
import { notify } from "./notify";
import { prisma } from "./prisma";

const HOUR = 60 * 60_000;
const REMINDER = 30 * 60_000;

export function startJobs(io: Server) {
  const tick = async () => {
    const now = new Date();
    const due = await prisma.booking.findMany({
      where: { status: "CONFIRMED", scheduledAt: { lt: new Date(now.getTime() - HOUR) } },
      include: { business: true },
      take: 50,
    });
    for (const booking of due) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelReason: "expired", arrivalOpen: false },
      });
      await notify(io, {
        userId: booking.business.userId,
        type: "BOOKING_EXPIRED",
        titleEl: "Το ραντεβού έληξε",
        titleEn: "Pickup expired",
        bodyEl: "Ακυρώθηκε αυτόματα μία ώρα μετά την ώρα του.",
        bodyEn: "It was cancelled automatically one hour after the slot.",
        data: { bookingId: booking.id },
      });
    }
    const soon = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        reminderSent: false,
        scheduledAt: { gt: now, lte: new Date(now.getTime() + REMINDER) },
      },
      include: { business: true },
      take: 50,
    });
    for (const booking of soon) {
      await prisma.booking.update({ where: { id: booking.id }, data: { reminderSent: true } });
      await notify(io, {
        userId: booking.business.userId,
        type: "BOOKING_REMINDER",
        titleEl: "Ραντεβού σε 30 λεπτά",
        titleEn: "Pickup in 30 minutes",
        bodyEl: "Το απορριμματοφόρο έρχεται μέσα στο επόμενο μισάωρο.",
        bodyEn: "The truck is due within the next half hour.",
        data: { bookingId: booking.id },
      });
    }
  };
  void tick().catch(() => undefined);
  setInterval(() => void tick().catch(() => undefined), 60_000);
}
