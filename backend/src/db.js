import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl() {
  if (process.env.NODE_ENV === "test") {
    return process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  }
  return process.env.DATABASE_URL;
}

const targetUrl = resolveDatabaseUrl();
const prisma = targetUrl
  ? new PrismaClient({ datasources: { db: { url: targetUrl } } })
  : new PrismaClient();

export default prisma;
