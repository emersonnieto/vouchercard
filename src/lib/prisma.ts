import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não definida no .env");
const resolvedDatabaseUrl = databaseUrl;

function isLocalDatabase(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function getSslConfig() {
  const explicitSsl = process.env.DATABASE_SSL;
  const shouldUseSsl =
    explicitSsl === "true" ||
    (explicitSsl !== "false" && !isLocalDatabase(resolvedDatabaseUrl));

  if (!shouldUseSsl) {
    return undefined;
  }

  return {
    rejectUnauthorized:
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

const ssl = getSslConfig();

const pool = new Pool({
  connectionString: resolvedDatabaseUrl,
  ...(ssl ? { ssl } : {}),
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});
