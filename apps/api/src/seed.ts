import { hashPassword } from "./auth";
import { seedDemo } from "./demoSeed";
import { env } from "./env";
import { prisma } from "./prisma";

export async function seed() {
  const municipality =
    (await prisma.municipality.findUnique({ where: { slug: "athens" } })) ??
    (await prisma.municipality.create({ data: { name: "Δήμος Αθηναίων", slug: "athens" } }));
  if (!env.seedDemo) {
    const existing = await prisma.user.findUnique({ where: { username: env.adminUsername } });
    if (existing) return existing;
    const user = await prisma.user.create({
      data: {
        username: env.adminUsername,
        passwordHash: await hashPassword(env.adminPassword),
        name: env.adminName,
        role: "ADMIN",
        locale: "el",
        municipalityId: municipality.id,
      },
    });
    console.log(`Empty seed. Admin username=${user.username}`);
    return user;
  }
  await seedDemo(municipality);
  return prisma.user.findUnique({ where: { username: "demo_admin" } });
}

if (require.main === module) {
  seed()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
