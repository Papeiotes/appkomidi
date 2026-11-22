import {
  BookingError,
  bookInTransaction,
  cancelInTransaction,
  isValidLatLng,
  type BookingStatus,
} from "@vardia/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient;

async function lockShift(tx: Tx, shiftId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Shift" WHERE id = ${shiftId} FOR UPDATE`;
  if (rows.length === 0) throw new BookingError("SHIFT_NOT_FOUND");
}

export async function createBooking(input: {
  shiftId: string;
  userId: string;
  seats: number;
  pickupLat: number;
  pickupLng: number;
  pickupLabel: string;
  now?: Date;
}) {
  if (!isValidLatLng(input.pickupLat, input.pickupLng)) throw new BookingError("BAD_INPUT");
  const now = input.now ?? new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await bookInTransaction({
        lockShift: () => lockShift(tx, input.shiftId),
        load: async () => {
          const shift = await tx.shift.findUnique({ where: { id: input.shiftId } });
          if (!shift) return null;
          const confirmed = await tx.booking.findMany({
            where: { shiftId: input.shiftId, status: "CONFIRMED" },
            select: { userId: true, seats: true },
          });
          return {
            id: shift.id,
            status: shift.status,
            capacity: shift.capacity,
            confirmedSeats: confirmed.reduce((sum, row) => sum + row.seats, 0),
            passengerIds: confirmed.map((row) => row.userId),
            departsAt: shift.departsAt.toISOString(),
            lockMinutes: shift.lockMinutes,
          };
        },
        insert: (seats) =>
          tx.booking.create({
            data: {
              shiftId: input.shiftId,
              userId: input.userId,
              seats,
              pickupLat: input.pickupLat,
              pickupLng: input.pickupLng,
              pickupLabel: input.pickupLabel,
            },
          }),
        requestedSeats: input.seats,
        userId: input.userId,
        now,
      });
      if (!result.ok) throw new BookingError(result.code);
      return result;
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      throw new BookingError("ALREADY_BOOKED");
    }
    throw error;
  }
}

export async function cancelBooking(input: { bookingId: string; userId: string; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({ where: { id: input.bookingId } });
    if (!existing || existing.userId !== input.userId) throw new BookingError("BOOKING_NOT_FOUND");
    const result = await cancelInTransaction({
      lockShift: () => lockShift(tx, existing.shiftId),
      load: async () => {
        const shift = await tx.shift.findUnique({ where: { id: existing.shiftId } });
        const booking = await tx.booking.findUnique({ where: { id: input.bookingId } });
        if (!shift || !booking) return null;
        return {
          shiftStatus: shift.status,
          departsAt: shift.departsAt.toISOString(),
          lockMinutes: shift.lockMinutes,
          bookingStatus: booking.status as BookingStatus,
        };
      },
      cancel: () =>
        tx.booking.update({
          where: { id: input.bookingId },
          data: { status: "CANCELLED" },
        }),
      now,
    });
    if (!result.ok) throw new BookingError(result.code);
    return result.booking;
  });
}
