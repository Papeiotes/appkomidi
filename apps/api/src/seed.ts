import { hashPassword } from "./auth";
import { env } from "./env";
import { prisma } from "./prisma";

export async function seed() {
  const municipality =
    (await prisma.municipality.findUnique({ where: { slug: "default" } })) ??
    (await prisma.municipality.create({ data: { name: env.municipalityName, slug: "default" } }));
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
  console.log(`Seeded admin username=${user.username}`);
  return user;
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
