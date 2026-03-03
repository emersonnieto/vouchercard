import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { requireAuth } from "./middlewares/requireAuth";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

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

function parseCsvEnv(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo`);
  }

  return Math.floor(parsed);
}

const allowedOrigins = parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS);
const hasCorsWhitelist = allowedOrigins.length > 0;

const loginRateLimitWindowMs = readPositiveIntEnv(
  "LOGIN_RATE_LIMIT_WINDOW_MS",
  15 * 60 * 1000
);
const loginRateLimitMax = readPositiveIntEnv("LOGIN_RATE_LIMIT_MAX", 10);
const publicVoucherRateLimitWindowMs = readPositiveIntEnv(
  "PUBLIC_VOUCHER_RATE_LIMIT_WINDOW_MS",
  5 * 60 * 1000
);
const publicVoucherRateLimitMax = readPositiveIntEnv(
  "PUBLIC_VOUCHER_RATE_LIMIT_MAX",
  60
);

const loginRateLimit = createRateLimiter({
  keyPrefix: "login",
  windowMs: loginRateLimitWindowMs,
  max: loginRateLimitMax,
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
  windowMs: publicVoucherRateLimitWindowMs,
  max: publicVoucherRateLimitMax,
});

app.disable("x-powered-by");

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!isProduction || !hasCorsWhitelist || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem nao permitida pelo CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "12mb" }));

if (isProduction) {
  if (!hasCorsWhitelist) {
    console.warn(
      "[CORS] CORS_ALLOWED_ORIGINS nao configurado; liberando todas as origens ate configurar a whitelist."
    );
  }
  console.warn(
    "[RATE_LIMIT] usando armazenamento em memoria por instancia; para multi-instancia, substitua por storage compartilhado."
  );
}

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
