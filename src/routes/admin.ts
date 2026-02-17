import { Router } from "express";
import { prisma } from "../lib/prisma";

export const adminRouter = Router();

/**
 * POST /admin/agencies
 * body: { name: string, phone?: string, email?: string }
 */
adminRouter.post("/agencies", async (req, res) => {
  try {
    const { name, phone, email } = req.body ?? {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "name é obrigatório" });
    }

    const agency = await prisma.agency.create({
      data: {
        name: name.trim(),
        phone: phone?.toString(),
        email: email?.toString(),
      },
    });

    return res.status(201).json(agency);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * POST /admin/vouchers
 * body exemplo:
 * {
 *   "agencyId": "uuid",
 *   "reservationCode": "ABC123",
 *   "clientName": "Fulano",
 *   "flights": [
 *     { "direction": "OUTBOUND", "flightNumber": "G3 1234", "departureTime": "08:10", "arrivalTime": "10:20", "embarkAirport": "GRU", "disembarkAirport": "REC" },
 *     { "direction": "RETURN",   "flightNumber": "G3 4321", "departureTime": "18:30", "arrivalTime": "20:40", "embarkAirport": "REC", "disembarkAirport": "GRU" }
 *   ],
 *   "hotel": { "hotelName": "Hotel X", "mealPlan": "Café", "roomType": "Standard", "checkInTime": "14:00", "checkOutTime": "12:00" },
 *   "transfer": { "receptiveName": "Receptivo Y" }
 * }
 */
adminRouter.post("/vouchers", async (req, res) => {
  try {
    const { agencyId, reservationCode, clientName, flights, hotel, transfer } = req.body ?? {};

    if (!agencyId || typeof agencyId !== "string") {
      return res.status(400).json({ message: "agencyId é obrigatório" });
    }
    if (!reservationCode || typeof reservationCode !== "string") {
      return res.status(400).json({ message: "reservationCode é obrigatório" });
    }
    if (!clientName || typeof clientName !== "string") {
      return res.status(400).json({ message: "clientName é obrigatório" });
    }

    // Flights: precisa ter OUTBOUND e RETURN (ida e volta)
    if (!Array.isArray(flights) || flights.length < 1) {
      return res.status(400).json({ message: "flights é obrigatório" });
    }

    const hasOutbound = flights.some((f: any) => f?.direction === "OUTBOUND");
    const hasReturn = flights.some((f: any) => f?.direction === "RETURN");

    if (!hasOutbound || !hasReturn) {
      return res.status(400).json({ message: "Inclua flights com direction OUTBOUND e RETURN" });
    }

    // cria tudo em uma transação
    const created = await prisma.voucher.create({
      data: {
        agencyId,
        reservationCode: reservationCode.trim(),
        clientName: clientName.trim(),
        flights: {
          create: flights.map((f: any) => ({
            direction: f.direction,
            flightNumber: f.flightNumber?.toString(),
            departureTime: f.departureTime?.toString(),
            arrivalTime: f.arrivalTime?.toString(),
            embarkAirport: f.embarkAirport?.toString(),
            disembarkAirport: f.disembarkAirport?.toString(),
          })),
        },
        hotel: hotel
          ? {
              create: {
                hotelName: hotel.hotelName?.toString() ?? "",
                mealPlan: hotel.mealPlan?.toString(),
                roomType: hotel.roomType?.toString(),
                checkInTime: hotel.checkInTime?.toString(),
                checkOutTime: hotel.checkOutTime?.toString(),
              },
            }
          : undefined,
        transfer: transfer
          ? {
              create: {
                receptiveName: transfer.receptiveName?.toString(),
              },
            }
          : undefined,
      },
      include: { flights: true, hotel: true, transfer: true },
    });

    return res.status(201).json(created);
  } catch (err: any) {
    console.error(err);

    // erro de unique (reservationCode por agency)
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "reservationCode já existe para essa agência" });
    }

    return res.status(500).json({ message: "Erro interno" });
  }
});
