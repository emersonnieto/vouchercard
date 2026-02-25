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