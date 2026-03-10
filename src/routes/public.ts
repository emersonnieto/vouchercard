import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const publicRouter = Router();

const voucherPublicInclude = {
  flights: true,
  tours: true,
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

publicRouter.get("/vouchers/:publicCode", async (req: Request, res: Response) => {
  try {
    const publicCode = String(req.params.publicCode || "").trim().toUpperCase();

    if (!publicCode) {
      return res.status(400).json({ message: "publicCode invalido" });
    }

    const voucher: PublicVoucher | null = await prisma.voucher.findFirst({
      where: {
        publicCode,
        agency: {
          isActive: true,
        },
      },
      include: voucherPublicInclude,
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher nao encontrado" });
    }

    const order: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
    const flightsSorted = [...voucher.flights].sort(
      (a, b) =>
        (order[a.direction] ?? 99) - (order[b.direction] ?? 99) ||
        a.segmentOrder - b.segmentOrder
    );

    const toursSorted = [...voucher.tours].sort((a, b) => a.sortOrder - b.sortOrder);

    return res.json({ ...voucher, flights: flightsSorted, tours: toursSorted });
  } catch (err) {
    console.error("[PUBLIC] erro:", err);
    return res.status(500).json({ message: "Erro interno" });
  }
});
