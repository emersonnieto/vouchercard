import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const publicRouter = Router();

/**
 * 🔎 DEBUG: confirma se a API está conectada no banco correto
 * GET /public/debug
 */
publicRouter.get("/debug", async (_req: Request, res: Response) => {
  try {
    const total = await prisma.voucher.count();

    const last = await prisma.voucher.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        reservationCode: true,
        agencyId: true,
        createdAt: true,
      },
    });

    return res.json({ total, last });
  } catch (err) {
    console.error("[PUBLIC][DEBUG] erro:", err);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * 🌍 Público (APP): buscar voucher por reservationCode
 * GET /public/vouchers/:reservationCode
 *
 * ✅ Busca case-insensitive (resolve problema de maiúsculo/minúsculo)
 * ✅ Ordena voos (OUTBOUND primeiro, RETURN depois)
 */
publicRouter.get("/vouchers/:reservationCode", async (req: Request, res: Response) => {
  try {
    const reservationCode = String(req.params.reservationCode || "").trim();

    if (!reservationCode) {
      return res.status(400).json({ message: "reservationCode inválido" });
    }

    const voucher = await prisma.voucher.findFirst({
      where: {
        reservationCode: {
          equals: reservationCode,
          mode: "insensitive", // 🔥 resolve diferença de maiúsculo/minúsculo
        },
      },
      include: {
        flights: true,
        hotel: true,
        transfer: true,
        stopover: true,
        tours: true,
        travelInsurance: true,
        agency: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            email: true,
            logoUrl: true,
            primaryColor: true,
            isActive: true,
          },
        },
      },
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher não encontrado" });
    }

    // (opcional) bloquear agência inativa
    if (voucher.agency?.isActive === false) {
      return res.status(404).json({ message: "Voucher não encontrado" });
    }

    // ✅ Ordena voos
    const order: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
    const flightsSorted = [...voucher.flights].sort(
      (a, b) => (order[a.direction] ?? 99) - (order[b.direction] ?? 99)
    );

    return res.json({ ...voucher, flights: flightsSorted });
  } catch (err) {
    console.error("[PUBLIC] erro:", err);
    return res.status(500).json({ message: "Erro interno" });
  }
});
