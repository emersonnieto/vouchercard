import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL nao definida no .env");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const agency = await prisma.agency.create({
    data: {
      name: "Agencia Teste",
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
          mealPlan: "Cafe da manha",
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
      stopover: {
        create: {
          location: "Brasilia",
          duration: "1h15",
        },
      },
      tours: {
        create: [
          {
            name: "City Tour",
            dateTime: "09:00",
            meetingPoint: "Lobby do hotel",
          },
        ],
      },
      travelInsurance: {
        create: {
          providerName: "Seguradora Exemplo",
          providerPhone: "0800 000 000",
        },
      },
    },
  });

  console.log("Seed OK");
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
