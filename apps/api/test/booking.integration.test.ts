import { shiftEndsAt } from "@vardia/shared";
import { afterAll, expect, it } from "vitest";
import { createBooking } from "../src/bookingService";
import { prisma } from "../src/prisma";

const stamp = `waste-${Date.now()}`;
const ids: string[] = [];

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { business: { name: { contains: stamp } } } });
  await prisma.shift.deleteMany({ where: { driver: { username: { contains: stamp } } } });
  await prisma.truck.deleteMany({ where: { municipality: { slug: stamp } } });
  await prisma.business.deleteMany({ where: { name: { contains: stamp } } });
  await prisma.user.deleteMany({ where: { username: { contains: stamp } } });
  await prisma.municipality.deleteMany({ where: { slug: stamp } });
  await prisma.$disconnect();
});

it("locks the truck so two 50+ pickups cannot both take the last kilograms", async () => {
  const municipality = await prisma.municipality.create({ data: { name: stamp, slug: stamp } });
  const driver = await prisma.user.create({
    data: {
      username: `${stamp}-driver`,
      passwordHash: "x",
      role: "DRIVER",
      name: "Driver",
      municipalityId: municipality.id,
    },
  });
  ids.push(driver.id);
  const truck = await prisma.truck.create({
    data: { municipalityId: municipality.id, binType: "GREEN", capacityKg: 100 },
  });
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  startsAt.setUTCMinutes(0, 0, 0);
  const shift = await prisma.shift.create({
    data: {
      municipalityId: municipality.id,
      truckId: truck.id,
      driverId: driver.id,
      startsAt,
      endsAt: shiftEndsAt(startsAt),
    },
  });
  const businesses = await Promise.all(
    [1, 2].map(async (n) => {
      const user = await prisma.user.create({
        data: {
          username: `${stamp}-shop${n}`,
          passwordHash: "x",
          role: "BUSINESS",
          name: `Shop ${n}`,
          municipalityId: municipality.id,
        },
      });
      return prisma.business.create({
        data: {
          userId: user.id,
          municipalityId: municipality.id,
          name: `${stamp} shop ${n}`,
          afm: "090000045",
          phone: "2100000000",
          contactName: `Shop ${n}`,
          street: "Σταδίου",
          streetNumber: String(n),
          addressLabel: "Σταδίου",
          lat: 37.98,
          lng: 23.73,
          status: "APPROVED",
        },
      });
    }),
  );
  const scheduledAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const attempts = await Promise.allSettled(
    businesses.map((business) =>
      createBooking({ businessId: business.id, binType: "GREEN", bracket: "KG_50_PLUS", scheduledAt }),
    ),
  );
  const ok = attempts.filter((attempt) => attempt.status === "fulfilled");
  const full = attempts.filter(
    (attempt) => attempt.status === "rejected" && (attempt.reason as { code?: string }).code === "TRUCK_FULL",
  );
  expect(ok).toHaveLength(1);
  expect(full).toHaveLength(1);
  const used = await prisma.booking.aggregate({
    where: { shiftId: shift.id, status: "CONFIRMED" },
    _sum: { kg: true },
  });
  expect(used._sum.kg).toBe(75);
});
