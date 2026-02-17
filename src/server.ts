import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { adminRouter } from "./routes/admin";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ message: "API Voucher SaaS rodando 🚀" }));

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// Rotas admin (MVP sem auth ainda)
app.use("/admin", adminRouter);

// Rota do app (sem login)
app.get("/vouchers/:agencyId/:reservationCode", async (req, res) => {
  try {
    const { agencyId, reservationCode } = req.params;

    const voucher = await prisma.voucher.findFirst({
      where: { agencyId, reservationCode },
      include: {
        agency: { select: { id: true, name: true, phone: true, email: true } },
        hotel: true,
        transfer: true,
        flights: true,
      },
    });

    if (!voucher) return res.status(404).json({ message: "Voucher não encontrado" });

    const flightsSorted = [...voucher.flights].sort((a, b) => {
      const order = { OUTBOUND: 0, RETURN: 1 } as const;
      return order[a.direction] - order[b.direction];
    });

    res.json({ ...voucher, flights: flightsSorted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro interno" });
  }
});

app.listen(3333, () => console.log("Servidor rodando na porta 3333"));
