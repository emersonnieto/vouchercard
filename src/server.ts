import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { requireAuth } from "./middlewares/requireAuth";

const app = express();

app.use(cors());
app.use(express.json());

/**
 * 🌐 Rota raiz
 */
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "API Voucher SaaS rodando 🚀" });
});

/**
 * ❤️ Health check (usado pelo Render)
 */
app.get("/health", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

/**
 * 🔐 Rotas públicas de autenticação
 */
app.use("/auth", authRouter);

/**
 * 🔒 Rotas administrativas protegidas por JWT
 * Header: Authorization: Bearer TOKEN
 */
app.use("/admin", requireAuth, adminRouter);

/**
 * 🌍 Rota pública principal do app (por SLUG)
 * GET /vouchers/:slug/:reservationCode
 */
app.get("/vouchers/:slug/:reservationCode", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug).trim().toLowerCase();
    const reservationCode = String(req.params.reservationCode).trim();

    if (!slug || !reservationCode) {
      return res.status(400).json({ message: "Parâmetros inválidos" });
    }

    // 1️⃣ Busca agência pelo slug
    const agency = await prisma.agency.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, phone: true, email: true },
    });

    if (!agency) {
      return res.status(404).json({ message: "Agência não encontrada" });
    }

    // 2️⃣ Busca voucher pelo agencyId + reservationCode
    const voucher = await prisma.voucher.findFirst({
      where: {
        agencyId: agency.id,
        reservationCode,
      },
      include: {
        agency: { select: { id: true, name: true, slug: true, phone: true, email: true } },
        hotel: true,
        transfer: true,
        flights: true,
      },
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher não encontrado" });
    }

    // 3️⃣ Ordena voos (ida primeiro, volta depois)
    const order: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
    const flightsSorted = [...voucher.flights].sort(
      (a, b) => (order[a.direction] ?? 99) - (order[b.direction] ?? 99)
    );

    return res.json({ ...voucher, flights: flightsSorted });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * 🆔 (Opcional) Rota antiga por agencyId
 * GET /vouchers/by-id/:agencyId/:reservationCode
 */
app.get("/vouchers/by-id/:agencyId/:reservationCode", async (req: Request, res: Response) => {
  try {
    const agencyId = String(req.params.agencyId).trim();
    const reservationCode = String(req.params.reservationCode).trim();

    const voucher = await prisma.voucher.findFirst({
      where: { agencyId, reservationCode },
      include: {
        agency: { select: { id: true, name: true, slug: true, phone: true, email: true } },
        hotel: true,
        transfer: true,
        flights: true,
      },
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher não encontrado" });
    }

    const order: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
    const flightsSorted = [...voucher.flights].sort(
      (a, b) => (order[a.direction] ?? 99) - (order[b.direction] ?? 99)
    );

    return res.json({ ...voucher, flights: flightsSorted });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * 🚀 Start do servidor
 */
const PORT = Number(process.env.PORT) || 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
