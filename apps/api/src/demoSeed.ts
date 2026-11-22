import { athensInstant, athensParts, OFFICE_PERMISSIONS, shiftEndsAt } from "@vardia/shared";
import type { BinType, Municipality, QuantityBracket } from "@prisma/client";
import { hashPassword } from "./auth";
import { prisma } from "./prisma";

const PASSWORD = "demo1234";

const areas: { name: string; ring: [number, number][] }[] = [
  { name: "Πλάκα", ring: [[23.724, 37.969], [23.736, 37.969], [23.736, 37.979], [23.724, 37.979]] },
  { name: "Κουκάκι", ring: [[23.716, 37.958], [23.736, 37.958], [23.736, 37.969], [23.716, 37.969]] },
  { name: "Εξάρχεια", ring: [[23.728, 37.981], [23.745, 37.981], [23.745, 37.992], [23.728, 37.992]] },
  { name: "Παγκράτι", ring: [[23.738, 37.96], [23.758, 37.96], [23.758, 37.975], [23.738, 37.975]] },
];

const shops = [
  { username: "demo_business", name: "Καφέ Η Πλάκα", contact: "Παπαδόπουλος", phone: "2103211001", street: "Αδριανού", number: "98", lat: 37.9722, lng: 23.7302, area: "Πλάκα" },
  { username: "demo_shop_exarchia", name: "Βιβλία Εξαρχείων", contact: "Νικολάου", phone: "2103812202", street: "Θεμιστοκλέους", number: "42", lat: 37.9862, lng: 23.7342, area: "Εξάρχεια" },
  { username: "demo_shop_koukaki", name: "Φούρνος Κουκακίου", contact: "Αλεξίου", phone: "2109223303", street: "Βεΐκου", number: "28", lat: 37.9662, lng: 23.7265, area: "Κουκάκι" },
  { username: "demo_shop_pangrati", name: "Μανάβικο Παγκρατίου", contact: "Γεωργίου", phone: "2107014404", street: "Ευστρατίου", number: "12", lat: 37.9688, lng: 23.7462, area: "Παγκράτι" },
];

const drivers: { username: string; name: string; bin: BinType; plate: string }[] = [
  { username: "demo_driver", name: "Γιώργος Λάμπρου", bin: "GREEN", plate: "ΥΝΒ 4101" },
  { username: "demo_driver_blue", name: "Μαρία Κωνσταντίνου", bin: "BLUE", plate: "ΥΝΒ 4102" },
  { username: "demo_driver_yellow", name: "Νίκος Δημητρίου", bin: "YELLOW", plate: "ΥΝΒ 4103" },
  { username: "demo_driver_brown", name: "Ελένη Βασιλείου", bin: "BROWN", plate: "ΥΝΒ 4104" },
];

/** Civil clock time in Europe/Athens, `dayOffset` days from the Athens date of this run. */
function athensAt(dayOffset: number, hour: number, minute = 0) {
  const today = athensParts(new Date());
  const civil = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset));
  return athensInstant(civil.getUTCFullYear(), civil.getUTCMonth() + 1, civil.getUTCDate(), hour, minute, 0);
}

async function replaceScheduledShift(input: {
  municipalityId: string;
  driverId: string;
  truckId: string;
  start: Date;
  bookings: { name: string; at: Date; bracket: QuantityBracket; kg: number; bin: BinType }[];
}) {
  const day = athensParts(input.start);
  const dayStart = athensInstant(day.year, day.month, day.day, 0, 0, 0);
  const dayEnd = athensInstant(day.year, day.month, day.day, 23, 59, 59);
  const live = await prisma.shift.findFirst({
    where: {
      driverId: input.driverId,
      status: { in: ["IN_PROGRESS", "PAUSED"] },
      startsAt: { gte: dayStart, lte: dayEnd },
    },
  });
  if (live) return;
  const existing = await prisma.shift.findMany({
    where: { driverId: input.driverId, status: { in: ["SCHEDULED", "ENDED"] }, startsAt: { gte: dayStart, lte: dayEnd } },
  });
  for (const shift of existing) {
    await prisma.booking.deleteMany({ where: { shiftId: shift.id } });
    await prisma.slotClosure.deleteMany({ where: { shiftId: shift.id } });
    await prisma.shift.delete({ where: { id: shift.id } });
  }
  const shift = await prisma.shift.create({
    data: {
      municipalityId: input.municipalityId,
      truckId: input.truckId,
      driverId: input.driverId,
      startsAt: input.start,
      endsAt: shiftEndsAt(input.start),
    },
  });
  for (const slot of input.bookings) {
    const business = await prisma.business.findFirst({ where: { municipalityId: input.municipalityId, name: slot.name } });
    if (!business) continue;
    await prisma.booking.create({
      data: {
        municipalityId: input.municipalityId,
        businessId: business.id,
        shiftId: shift.id,
        binType: slot.bin,
        bracket: slot.bracket,
        kg: slot.kg,
        scheduledAt: slot.at,
      },
    });
  }
}

export async function seedDemo(municipality: Municipality) {
  const passwordHash = await hashPassword(PASSWORD);
  const areaIds = new Map<string, string>();
  for (const area of areas) {
    const existing = await prisma.subArea.findFirst({ where: { municipalityId: municipality.id, name: area.name } });
    const row = existing ?? (await prisma.subArea.create({ data: { municipalityId: municipality.id, name: area.name, ring: area.ring } }));
    areaIds.set(area.name, row.id);
  }

  async function user(username: string, role: "ADMIN" | "OFFICE" | "DRIVER" | "BUSINESS", name: string, phone?: string) {
    return (
      (await prisma.user.findUnique({ where: { username } })) ??
      (await prisma.user.create({
        data: {
          username,
          passwordHash,
          role,
          name,
          phone,
          municipalityId: municipality.id,
          permissions: role === "OFFICE" ? [...OFFICE_PERMISSIONS] : [],
        },
      }))
    );
  }

  await user("demo_admin", "ADMIN", "Διαχειριστής Δήμου");
  await user("demo_office", "OFFICE", "Γραφείο Καθαριότητας", "2105277000");

  const driverUsers = [];
  for (const driver of drivers) {
    const account = await user(driver.username, "DRIVER", driver.name, "6900000000");
    const truck = await prisma.truck.findFirst({ where: { driverId: account.id, binType: driver.bin } });
    if (!truck) {
      await prisma.truck.create({
        data: {
          municipalityId: municipality.id,
          binType: driver.bin,
          capacityKg: 800,
          plate: driver.plate,
          driverId: account.id,
        },
      });
    }
    driverUsers.push(account);
  }

  for (const shop of shops) {
    const account = await user(shop.username, "BUSINESS", shop.contact, shop.phone);
    const business = await prisma.business.findUnique({ where: { userId: account.id } });
    if (!business) {
      await prisma.business.create({
        data: {
          userId: account.id,
          municipalityId: municipality.id,
          name: shop.name,
          afm: "090000045",
          phone: shop.phone,
          contactName: shop.contact,
          street: shop.street,
          streetNumber: shop.number,
          addressLabel: `${shop.street} ${shop.number}, Αθήνα`,
          lat: shop.lat,
          lng: shop.lng,
          status: "APPROVED",
          subAreaId: areaIds.get(shop.area),
        },
      });
    }
  }

  const green = driverUsers[0];
  const greenTruck = await prisma.truck.findFirst({ where: { driverId: green.id, binType: "GREEN" } });
  if (!greenTruck) return;
  await replaceScheduledShift({
    municipalityId: municipality.id,
    driverId: green.id,
    truckId: greenTruck.id,
    start: athensAt(0, 8),
    bookings: [
      { name: "Καφέ Η Πλάκα", at: athensAt(0, 8, 30), bracket: "KG_10_20", kg: 20, bin: "GREEN" },
      { name: "Βιβλία Εξαρχείων", at: athensAt(0, 9, 15), bracket: "KG_0_10", kg: 10, bin: "GREEN" },
      { name: "Φούρνος Κουκακίου", at: athensAt(0, 10, 0), bracket: "KG_20_50", kg: 50, bin: "GREEN" },
      { name: "Μανάβικο Παγκρατίου", at: athensAt(0, 10, 45), bracket: "KG_10_20", kg: 20, bin: "GREEN" },
    ],
  });

  for (const [index, account] of driverUsers.entries()) {
    const truck = await prisma.truck.findFirst({ where: { driverId: account.id } });
    if (!truck) continue;
    await replaceScheduledShift({
      municipalityId: municipality.id,
      driverId: account.id,
      truckId: truck.id,
      start: athensAt(1, 8),
      bookings:
        index === 0
          ? [{ name: "Καφέ Η Πλάκα", at: athensAt(1, 9, 0), bracket: "KG_0_10", kg: 10, bin: truck.binType }]
          : [],
    });
  }
  console.log("Demo ready. Password for every demo_* account: demo1234");
}
