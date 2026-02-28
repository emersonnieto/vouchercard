import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { requireAuth } from "./middlewares/requireAuth";

const app = express();

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
};

function createRateLimiter({
  keyPrefix,
  windowMs,
  max,
  keyFn,
}: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const rawKey =
      keyFn?.(req) || req.ip || req.socket.remoteAddress || "unknown";
    const normalizedKey = rawKey.trim().toLowerCase() || "unknown";
    const cacheKey = `${keyPrefix}:${normalizedKey}`;

    for (const [storedKey, entry] of hits) {
      if (entry.resetAt <= now) {
        hits.delete(storedKey);
      }
    }

    const current = hits.get(cacheKey);

    if (!current || current.resetAt <= now) {
      hits.set(cacheKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: "Muitas tentativas. Aguarde antes de tentar novamente.",
      });
    }

    current.count += 1;
    hits.set(cacheKey, current);
    return next();
  };
}

const loginRateLimit = createRateLimiter({
  keyPrefix: "login",
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    return `${req.ip}:${email}`;
  },
});

const publicVoucherRateLimit = createRateLimiter({
  keyPrefix: "public-voucher",
  windowMs: 5 * 60 * 1000,
  max: 60,
});

app.disable("x-powered-by");

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "12mb" }));

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
app.use("/auth/login", loginRateLimit);
app.use("/auth", authRouter);

/**
 * 🌍 Rotas públicas do APP (sem login)
 * Ex: GET /public/vouchers/ABC123
 */
app.use("/public/vouchers", publicVoucherRateLimit);
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
