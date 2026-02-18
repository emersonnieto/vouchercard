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

app.get("/", (req: Request, res: Response) => res.json({ message: "API Voucher SaaS rodando 🚀" }));

app.get("/health", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// 🔐 login
app.use("/auth", authRouter);

// 🔒 admin protegido por JWT (Authorization: Bearer TOKEN)
app.use("/admin", requireAuth, adminRouter);

// rota pública do app (por enquanto ainda com agencyId; depois trocamos pra slug)
app.get("/vouchers/:agencyId/:reservationCode", async (req: Request, res: Response) => {
  try {
    const agencyId = String(req.params.agencyId);
    const reservationCode = String(req.params.reservationCode);

    const voucher = await prisma.voucher.findFirst({
      where: { agencyId, reservationCode },
      include: {
        agency: { select: { id: true, name: true, slug: true, phone: true, email: true } },
        hotel: true,
        transfer: true,
        flights: true,
      },
    });

    if (!voucher) return res.status(404).json({ message: "Voucher não encontrado" });

    const order: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
    const flightsSorted = [...voucher.flights].sort((a, b) => (order[a.direction] ?? 99) - (order[b.direction] ?? 99));

    res.json({ ...voucher, flights: flightsSorted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro interno" });
  }
});

const PORT = Number(process.env.PORT) || 3333;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
