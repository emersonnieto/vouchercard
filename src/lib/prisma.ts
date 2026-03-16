import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL nao definida no .env");
}

const appDatabaseUrl = process.env.DATABASE_URL_APP?.trim() || databaseUrl;

export const isDedicatedAppDatabaseUrlConfigured =
  appDatabaseUrl !== databaseUrl;

function isLocalDatabase(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function getSslConfig(connectionString: string) {
  const explicitSsl = process.env.DATABASE_SSL;
  const explicitRejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  const shouldUseSsl =
    explicitSsl === "true" ||
    (explicitSsl !== "false" && !isLocalDatabase(connectionString));

  if (!shouldUseSsl) {
    return undefined;
  }

  return {
    // Managed Postgres providers often require SSL even when cert verification
    // needs to stay relaxed in the runtime environment.
    rejectUnauthorized: explicitRejectUnauthorized === "true",
  };
}

function createPrismaClient(connectionString: string) {
  const ssl = getSslConfig(connectionString);
  const pool = new Pool({
    connectionString,
    ...(ssl ? { ssl } : {}),
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
  });
}

export const prisma = createPrismaClient(databaseUrl);
export const appPrisma = createPrismaClient(appDatabaseUrl);
