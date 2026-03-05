import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const publicRouter = Router();

const voucherPublicInclude = {
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
} as const;

type PublicVoucher = Prisma.VoucherGetPayload<{ include: typeof voucherPublicInclude }>;

publicRouter.get("/vouchers/:reservationCode", async (req: Request, res: Response) => {
  try {
    const reservationCode = String(req.params.reservationCode || "").trim();
    const agencySlug = String(req.query.agencySlug || "").trim().toLowerCase();

    if (!reservationCode) {
      return res.status(400).json({ message: "reservationCode invalido" });
    }

    const baseWhere = {
      reservationCode: {
        equals: reservationCode,
        mode: "insensitive" as const,
      },
      agency: {
        isActive: true,
      },
    };

    let voucher: PublicVoucher | null = null;

    if (agencySlug) {
      voucher = await prisma.voucher.findFirst({
        where: {
          ...baseWhere,
          agency: {
            isActive: true,
            slug: agencySlug,
          },
        },
        include: voucherPublicInclude,
      });

      if (!voucher) {
        return res.status(404).json({ message: "Voucher nao encontrado" });
      }
    } else {
      const vouchers = await prisma.voucher.findMany({
        where: baseWhere,
        include: voucherPublicInclude,
        take: 2,
        orderBy: { createdAt: "desc" },
      });

      if (!vouchers.length) {
        return res.status(404).json({ message: "Voucher nao encontrado" });
      }

      if (vouchers.length > 1) {
        return res.status(409).json({
          message: "Codigo de reserva duplicado entre agencias. Informe agencySlug.",
        });
      }

      voucher = vouchers[0];
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
