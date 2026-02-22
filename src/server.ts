import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { requireAuth } from "./middlewares/requireAuth";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

/**
 * 🌐 Rota raiz
 */
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "API Voucher SaaS rodando 🚀" });
});

/**
 * ❤️ Health check (Render/Railway)
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
 * 🌍 Rotas públicas do APP (sem login)
 * Ex: GET /public/vouchers/ABC123
 */
app.use("/public", publicRouter);

/**
 * 🔒 Rotas administrativas (painel) protegidas por JWT
 */
app.use("/admin", requireAuth, adminRouter);

/**
 * 🚫 404 padrão
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

const PORT = Number(process.env.PORT) || 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});