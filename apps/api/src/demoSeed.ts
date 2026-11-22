import { OFFICE_PERMISSIONS } from "@vardia/shared";
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

function atHour(dayOffset: number, hourUtc: number, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hourUtc, minute, 0, 0);
  return date;
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
  const todayStart = atHour(0, 6);
  const todayEnd = atHour(0, 12);
  let today = await prisma.shift.findFirst({ where: { driverId: green.id, startsAt: todayStart } });
  if (!today) {
    today = await prisma.shift.create({
      data: {
        municipalityId: municipality.id,
        truckId: greenTruck.id,
        driverId: green.id,
        startsAt: todayStart,
        endsAt: todayEnd,
      },
    });
    const businesses = await prisma.business.findMany({ where: { municipalityId: municipality.id, status: "APPROVED" } });
    const slots: { name: string; at: Date; bracket: QuantityBracket; kg: number }[] = [
      { name: "Καφέ Η Πλάκα", at: atHour(0, 6, 30), bracket: "KG_10_20", kg: 20 },
      { name: "Βιβλία Εξαρχείων", at: atHour(0, 7, 15), bracket: "KG_0_10", kg: 10 },
      { name: "Φούρνος Κουκακίου", at: atHour(0, 8, 0), bracket: "KG_20_50", kg: 50 },
      { name: "Μανάβικο Παγκρατίου", at: atHour(0, 8, 45), bracket: "KG_10_20", kg: 20 },
    ];
    for (const slot of slots) {
      const business = businesses.find((row) => row.name === slot.name);
      if (!business) continue;
      await prisma.booking.create({
        data: {
          municipalityId: municipality.id,
          businessId: business.id,
          shiftId: today.id,
          binType: "GREEN",
          bracket: slot.bracket,
          kg: slot.kg,
          scheduledAt: slot.at,
        },
      });
    }
  }

  for (const [index, account] of driverUsers.entries()) {
    const truck = await prisma.truck.findFirst({ where: { driverId: account.id } });
    if (!truck) continue;
    const start = atHour(1, 6);
    const exists = await prisma.shift.findFirst({ where: { driverId: account.id, startsAt: start } });
    if (exists) continue;
    const shift = await prisma.shift.create({
      data: {
        municipalityId: municipality.id,
        truckId: truck.id,
        driverId: account.id,
        startsAt: start,
        endsAt: atHour(1, 12),
      },
    });
    if (index === 0) {
      const shop = await prisma.business.findFirst({ where: { name: "Καφέ Η Πλάκα" } });
      if (shop) {
        await prisma.booking.create({
          data: {
            municipalityId: municipality.id,
            businessId: shop.id,
            shiftId: shift.id,
            binType: "GREEN",
            bracket: "KG_0_10",
            kg: 10,
            scheduledAt: atHour(1, 7, 0),
          },
        });
      }
    }
  }
  console.log("Demo ready. Password for every demo_* account: demo1234");
}
