import {
  BookingError,
  assignUnderLock,
  evaluateCancel,
  isSameConfirmedSlot,
  kgForBracket,
  optimizeRoute,
  type BinType,
  type QuantityBracket,
} from "@vardia/shared";
import type { Prisma } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient;

async function lockCompatible(tx: Tx, municipalityId: string, binType: BinType, scheduledAt: Date) {
  const serviceEnd = new Date(scheduledAt.getTime() + 15 * 60_000);
  await tx.$queryRaw`
    SELECT s.id FROM "Shift" s
    JOIN "Truck" t ON t.id = s."truckId"
    WHERE s."municipalityId" = ${municipalityId}
      AND t."binType"::text = ${binType}
      AND s.status = 'SCHEDULED'
      AND s."startsAt" <= ${scheduledAt}
      AND s."endsAt" >= ${serviceEnd}
    ORDER BY s.id
    FOR UPDATE
  `;
}

async function loadCompatible(tx: Tx, municipalityId: string, binType: BinType, scheduledAt: Date) {
  const serviceEnd = new Date(scheduledAt.getTime() + 15 * 60_000);
  const shifts = await tx.shift.findMany({
    where: {
      municipalityId,
      status: "SCHEDULED",
      startsAt: { lte: scheduledAt },
      endsAt: { gte: serviceEnd },
      truck: { binType },
    },
    include: { truck: true, closures: true, bookings: { where: { status: "CONFIRMED" } } },
    orderBy: { id: "asc" },
  });
  return shifts.map((shift) => ({
    id: shift.id,
    status: shift.status,
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    capacityKg: shift.truck.capacityKg,
    usedKg: shift.bookings.reduce((sum, booking) => sum + booking.kg, 0),
    closedSlots: shift.closures.map((closure) => closure.slotAt.toISOString()),
  }));
}

export async function createBooking(input: {
  businessId: string;
  binType: BinType;
  bracket: QuantityBracket;
  kg?: number;
  scheduledAt: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const requestedKg = input.kg && input.kg > 0 ? input.kg : kgForBracket(input.bracket, env.overflowKg);
  return prisma.$transaction(async (tx) => {
    const business = await tx.business.findUnique({ where: { id: input.businessId } });
    if (!business || business.status !== "APPROVED") throw new BookingError("NOT_APPROVED");
    const prior = await tx.booking.findMany({
      where: { businessId: business.id, status: "CONFIRMED" },
      select: { binType: true, scheduledAt: true, status: true },
    });
    if (isSameConfirmedSlot(prior.map((row) => ({ ...row, scheduledAt: row.scheduledAt.toISOString() })), input.binType, input.scheduledAt.toISOString())) {
      throw new BookingError("DUPLICATE_BOOKING");
    }
    const result = await assignUnderLock({
      lockShifts: () => lockCompatible(tx, business.municipalityId, input.binType, input.scheduledAt),
      load: () => loadCompatible(tx, business.municipalityId, input.binType, input.scheduledAt),
      insert: async (shiftId) => {
        const shift = await tx.shift.findUnique({ where: { id: shiftId } });
        const rows = await tx.booking.findMany({
          where: { shiftId, status: "CONFIRMED" },
          include: { business: true },
        });
        const planned = optimizeRoute({
          start: { lat: business.lat, lng: business.lng },
          now: shift?.startsAt ?? now,
          stops: [
            ...rows.map((row) => ({
              id: row.id,
              at: { lat: row.business.lat, lng: row.business.lng },
              scheduledAt: row.scheduledAt.toISOString(),
            })),
            { id: "new", at: { lat: business.lat, lng: business.lng }, scheduledAt: input.scheduledAt.toISOString() },
          ],
        });
        if (!planned.feasible) throw new BookingError("ROUTE_INFEASIBLE");
        return tx.booking.create({
          data: {
            municipalityId: business.municipalityId,
            businessId: business.id,
            shiftId,
            binType: input.binType,
            bracket: input.bracket,
            kg: requestedKg,
            scheduledAt: input.scheduledAt,
          },
        });
      },
      scheduledAt: input.scheduledAt,
      now,
      requestedKg,
    });
    if (!result.ok) throw new BookingError(result.code);
    return result;
  });
}

export async function cancelBooking(input: { bookingId: string; businessId?: string; now?: Date; force?: boolean }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking) throw new BookingError("NOT_FOUND");
    if (input.businessId && booking.businessId !== input.businessId) throw new BookingError("NOT_FOUND");
    if (!input.force) {
      const decision = evaluateCancel({ status: booking.status, scheduledAt: booking.scheduledAt, now });
      if (!decision.ok) throw new BookingError(decision.code);
    } else if (booking.status !== "CONFIRMED") {
      throw new BookingError("NOT_CANCELLABLE");
    }
    return tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  });
}

export async function moveBooking(input: { bookingId: string; scheduledAt: Date; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: input.bookingId }, include: { business: true } });
    if (!booking || booking.status !== "CONFIRMED") throw new BookingError("NOT_CANCELLABLE");
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    const result = await assignUnderLock({
      lockShifts: () => lockCompatible(tx, booking.municipalityId, booking.binType, input.scheduledAt),
      load: () => loadCompatible(tx, booking.municipalityId, booking.binType, input.scheduledAt),
      insert: (shiftId) =>
        tx.booking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED", shiftId, scheduledAt: input.scheduledAt },
        }),
      scheduledAt: input.scheduledAt,
      now,
      requestedKg: booking.kg,
    });
    if (!result.ok) throw new BookingError(result.code);
    return result.booking;
  });
}
