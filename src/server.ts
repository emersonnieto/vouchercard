import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { adminRouter } from "./routes/admin";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * ✅ Admin Token (MVP)
 * Envie no header: x-admin-token: SEU_TOKEN
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-admin-token");
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    console.error("ADMIN_TOKEN não definido no .env");
    return res.status(500).json({ message: "Configuração do servidor ausente" });
  }

  if (!token || token !== adminToken) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  return next();
}

/**
 * ✅ Rotas públicas
 */
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "API Voucher SaaS rodando 🚀" });
});

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
 * 🔒 Rotas admin protegidas (MVP)
 */
app.use("/admin", requireAdmin, adminRouter);

/**
 * 📱 Rota do app (sem login)
 * GET /vouchers/:agencyId/:reservationCode
 */
app.get(
  "/vouchers/:agencyId/:reservationCode",
  async (req: Request, res: Response) => {
    try {
      // ✅ Garantimos string (evita erro string|string[])
      const agencyId = String(req.params.agencyId);
      const reservationCode = String(req.params.reservationCode);

      if (!agencyId || !reservationCode) {
        return res.status(400).json({ message: "Parâmetros inválidos" });
      }

      const voucher = await prisma.voucher.findFirst({
        where: {
          agencyId,
          reservationCode,
        },
        include: {
          agency: { select: { id: true, name: true, phone: true, email: true } },
          hotel: true,
          transfer: true,
          flights: true,
        },
      });

      if (!voucher) {
        return res.status(404).json({ message: "Voucher não encontrado" });
      }

      // Ordena voos: OUTBOUND primeiro, RETURN depois
      const order: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
      const flightsSorted = [...voucher.flights].sort((a, b) => {
        return (order[a.direction] ?? 99) - (order[b.direction] ?? 99);
      });

      return res.json({ ...voucher, flights: flightsSorted });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Erro interno" });
    }
  }
);

/**
 * 🟢 Start Server
 */
const PORT = Number(process.env.PORT) || 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
