import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ensureAgencySubscriptionAccess } from "../modules/billing/subscriptionAccess";
import {
  sendSupportContactEmail,
  SupportValidationError,
} from "../modules/support/support.service";

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
      },
      include: voucherPublicInclude,
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher nao encontrado" });
    }

    const agencyAccess = await ensureAgencySubscriptionAccess(voucher.agency.id);
    if (!agencyAccess.isActive) {
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

publicRouter.post("/support/contact", async (req: Request, res: Response) => {
  try {
    await sendSupportContactEmail({
      email: req.body?.email,
      message: req.body?.message,
      ip: req.ip,
      origin:
        typeof req.headers.origin === "string" ? req.headers.origin : undefined,
      userAgent:
        typeof req.headers["user-agent"] === "string"
          ? req.headers["user-agent"]
          : undefined,
    });

    return res.status(202).json({
      message: "Mensagem enviada com sucesso. Responderemos pelo email informado.",
    });
  } catch (err) {
    if (err instanceof SupportValidationError) {
      return res.status(400).json({ message: err.message });
    }

    console.error("[PUBLIC] support contact error:", err);
    return res.status(500).json({
      message: "Nao foi possivel enviar sua mensagem agora. Tente novamente em instantes.",
    });
  }
});
