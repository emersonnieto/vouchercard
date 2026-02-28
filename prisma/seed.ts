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

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const agency = await prisma.agency.create({
    data: {
      name: "Agência Teste",
      slug: "agencia-teste",
      phone: "11999999999",
      email: "agencia@teste.com",
    },
  });

  const voucher = await prisma.voucher.create({
    data: {
      agencyId: agency.id,
      reservationCode: "ABC123",
      clientName: "Cliente Teste",
      flights: {
        create: [
          {
            direction: "OUTBOUND",
            flightNumber: "G3 1234",
            departureTime: "08:10",
            arrivalTime: "10:20",
            embarkAirport: "GRU",
            disembarkAirport: "REC",
          },
          {
            direction: "RETURN",
            flightNumber: "G3 4321",
            departureTime: "18:30",
            arrivalTime: "20:40",
            embarkAirport: "REC",
            disembarkAirport: "GRU",
          },
        ],
      },
      hotel: {
        create: {
          hotelName: "Hotel Exemplo",
          mealPlan: "Café da manhã",
          roomType: "Standard",
          checkInTime: "14:00",
          checkOutTime: "12:00",
        },
      },
      transfer: {
        create: {
          receptiveName: "Receptivo Exemplo",
        },
      },
    },
  });

  console.log("✅ Seed OK");
  console.log("AGENCY_ID:", agency.id);
  console.log("RESERVA:", voucher.reservationCode);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
