import { afterAll, beforeAll, expect, it } from "vitest";
import { cancelBooking, createBooking } from "../src/bookingService";
import { prisma } from "../src/prisma";

const stamp = `lock-${Date.now()}`;
const ids: { businessId?: string; userIds: string[]; shiftId?: string } = { userIds: [] };

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  if (ids.businessId) {
    await prisma.booking.deleteMany({ where: { shift: { businessId: ids.businessId } } });
    await prisma.shift.deleteMany({ where: { businessId: ids.businessId } });
    await prisma.user.updateMany({ where: { businessId: ids.businessId }, data: { businessId: null } });
    await prisma.business.deleteMany({ where: { id: ids.businessId } });
  }
  if (ids.userIds.length) await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  await prisma.$disconnect();
});

it("holds capacity with a row lock when two riders book the last seat", async () => {
  const passwordHash = "not-used";
  const owner = await prisma.user.create({
    data: { email: `${stamp}-owner@vardia.test`, passwordHash, name: "Owner", role: "BUSINESS_OWNER" },
  });
  ids.userIds.push(owner.id);
  const business = await prisma.business.create({
    data: {
      name: `Test ${stamp}`,
      address: "Αθήνα",
      lat: 37.98,
      lng: 23.72,
      status: "APPROVED",
      inviteCode: stamp.slice(-8).toUpperCase(),
      ownerId: owner.id,
    },
  });
  ids.businessId = business.id;
  await prisma.user.update({ where: { id: owner.id }, data: { businessId: business.id } });

  const employees = await Promise.all(
    [1, 2].map((n) =>
      prisma.user.create({
        data: {
          email: `${stamp}-e${n}@vardia.test`,
          passwordHash,
          name: `Rider ${n}`,
          role: "EMPLOYEE",
          businessId: business.id,
        },
      }),
    ),
  );
  ids.userIds.push(...employees.map((user) => user.id));

  const shift = await prisma.shift.create({
    data: {
      businessId: business.id,
      title: "Πρωινή",
      direction: "TO_WORK",
      departsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      lockMinutes: 15,
      status: "OPEN",
      musterLat: 37.98,
      musterLng: 23.72,
      musterLabel: "Στάση",
      destLat: 37.99,
      destLng: 23.73,
      destLabel: "Έδρα",
    },
  });
  ids.shiftId = shift.id;

  const attempts = await Promise.allSettled(
    employees.map((user) =>
      createBooking({
        shiftId: shift.id,
        userId: user.id,
        seats: 1,
        pickupLat: 37.975,
        pickupLng: 23.73,
        pickupLabel: user.name,
      }),
    ),
  );

  const ok = attempts.filter((attempt) => attempt.status === "fulfilled");
  const full = attempts.filter(
    (attempt) => attempt.status === "rejected" && (attempt.reason as { code?: string }).code === "SHIFT_FULL",
  );
  expect(ok).toHaveLength(1);
  expect(full).toHaveLength(1);

  const confirmed = await prisma.booking.aggregate({
    where: { shiftId: shift.id, status: "CONFIRMED" },
    _sum: { seats: true },
  });
  expect(confirmed._sum.seats).toBe(1);

  const winner = ok[0].status === "fulfilled" ? ok[0].value.booking : null;
  expect(winner).toBeTruthy();
  await cancelBooking({ bookingId: winner!.id, userId: winner!.userId });
  const loser = employees.find((user) => user.id !== winner!.userId)!;
  const retried = await createBooking({
    shiftId: shift.id,
    userId: loser.id,
    seats: 1,
    pickupLat: 37.976,
    pickupLng: 23.731,
    pickupLabel: loser.name,
  });
  expect(retried.booking.userId).toBe(loser.id);

  await expect(
    createBooking({
      shiftId: shift.id,
      userId: loser.id,
      seats: 1,
      pickupLat: 37.976,
      pickupLng: 23.731,
      pickupLabel: loser.name,
    }),
  ).rejects.toMatchObject({ code: "ALREADY_BOOKED" });

  const locked = await prisma.shift.create({
    data: {
      businessId: business.id,
      title: "Κλειδωμένη",
      direction: "TO_WORK",
      departsAt: new Date(Date.now() + 10 * 60 * 1000),
      capacity: 4,
      lockMinutes: 30,
      status: "OPEN",
      musterLat: 37.98,
      musterLng: 23.72,
      musterLabel: "Στάση",
      destLat: 37.99,
      destLng: 23.73,
      destLabel: "Έδρα",
    },
  });
  await expect(
    createBooking({
      shiftId: locked.id,
      userId: loser.id,
      seats: 1,
      pickupLat: 37.98,
      pickupLng: 23.72,
      pickupLabel: "Κοντά",
    }),
  ).rejects.toMatchObject({ code: "SHIFT_LOCKED" });
  await prisma.shift.delete({ where: { id: locked.id } });
});
