import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const tenantId = "11111111-1111-1111-1111-111111111111";
  const userId = "22222222-2222-2222-2222-222222222222";
  const passwordHash = await bcrypt.hash("atlas-dev-password", 10);

  await prisma.tenant.upsert({
    where: { slug: "acme" },
    update: { name: "Acme Corp" },
    create: {
      id: tenantId,
      name: "Acme Corp",
      slug: "acme",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@acme.local" },
    update: {
      passwordHash,
      role: "admin",
      tenantId,
    },
    create: {
      id: userId,
      tenantId,
      email: "admin@acme.local",
      passwordHash,
      role: "admin",
    },
  });

  console.log("Seeded tenant=acme user=admin@acme.local password=atlas-dev-password");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
