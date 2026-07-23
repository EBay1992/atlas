import { PrismaClient } from "./generated/prisma/client.js";

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    ...(databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : {}),
    log:
      process.env["NODE_ENV"] === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export async function pingPrisma(prisma: PrismaClient): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export type { PrismaClient };
