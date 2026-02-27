import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const publicRouter = Router();

publicRouter.get("/vouchers/:reservationCode", async (req: Request, res: Response) => {
  try {
    const reservationCode = String(req.params.reservationCode || "").trim();

    if (!reservationCode) {
      return res.status(400).json({ message: "reservationCode invalido" });
    }

    const voucher = await prisma.voucher.findFirst({
      where: {
        reservationCode: {
          equals: reservationCode,
          mode: "insensitive",
        },
      },
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
            isActive: true,
          },
        },
      },
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher nao encontrado" });
    }

    if (voucher.agency?.isActive === false) {
      return res.status(404).json({ message: "Voucher nao encontrado" });
    }

    const order: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
    const flightsSorted = [...voucher.flights].sort(
      (a, b) =>
        (order[a.direction] ?? 99) - (order[b.direction] ?? 99) ||
        a.segmentOrder - b.segmentOrder
    );

    return res.json({ ...voucher, flights: flightsSorted });
  } catch (err) {
    console.error("[PUBLIC] erro:", err);
    return res.status(500).json({ message: "Erro interno" });
  }
});
