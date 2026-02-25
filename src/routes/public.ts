import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const publicRouter = Router();

/**
 * 🌍 Público (APP): buscar voucher por reservationCode (único global)
 * GET /public/vouchers/:reservationCode
 */
publicRouter.get("/vouchers/:reservationCode", async (req: Request, res: Response) => {
  try {
    const reservationCode = String(req.params.reservationCode || "").trim();

    if (!reservationCode) {
      return res.status(400).json({ message: "reservationCode inválido" });
    }

    const voucher = await prisma.voucher.findUnique({
      where: { reservationCode },
      include: {
        flights: true,
        hotel: true,
        transfer: true,
        agency: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            email: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher não encontrado" });
    }

    // ✅ Ordena voos: OUTBOUND primeiro, RETURN depois
    const order: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
    const flightsSorted = [...voucher.flights].sort(
      (a, b) => (order[a.direction] ?? 99) - (order[b.direction] ?? 99)
    );

    return res.json({ ...voucher, flights: flightsSorted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
});