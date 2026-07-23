import { PrismaClient } from "@prisma/client";

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    datasources: databaseUrl
      ? { db: { url: databaseUrl } }
      : undefined,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export async function pingPrisma(prisma: PrismaClient): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export type { PrismaClient };
