import { hashPassword } from "./auth";
import { env } from "./env";
import { prisma } from "./prisma";

export async function seed() {
  const existing = await prisma.user.findUnique({ where: { email: env.adminEmail } });
  if (existing) return existing;
  const user = await prisma.user.create({
    data: {
      email: env.adminEmail,
      passwordHash: await hashPassword(env.adminPassword),
      name: env.adminName,
      role: "ADMIN",
      locale: "el",
    },
  });
  console.log(`Seeded admin ${user.email}`);
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
