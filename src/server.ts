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

type RateLimitDecision = {
  count: number;
  retryAfterSeconds: number;
};

type RateLimitRow = {
  count: number | bigint;
  retry_after_seconds: number | bigint;
};

const fallbackRateLimitHits = new Map<string, { count: number; resetAt: number }>();
let rateLimitStoreReady: Promise<void> | null = null;
let warnedAboutRateLimitFallback = false;

function toSafeNumber(value: number | bigint | null | undefined, fallback = 0) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

async function ensureRateLimitStore() {
  if (!rateLimitStoreReady) {
    rateLimitStoreReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS app_rate_limits (
          key TEXT PRIMARY KEY,
          count INTEGER NOT NULL,
          reset_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_app_rate_limits_reset_at
        ON app_rate_limits (reset_at)
      `);
    })();
  }

  await rateLimitStoreReady;
}

async function consumeDistributedRateLimit(
  cacheKey: string,
  windowMs: number
): Promise<RateLimitDecision> {
  await ensureRateLimitStore();

  const rows = await prisma.$queryRawUnsafe<RateLimitRow[]>(
    `
      INSERT INTO app_rate_limits (key, count, reset_at, updated_at)
      VALUES ($1, 1, NOW() + ($2 * INTERVAL '1 millisecond'), NOW())
      ON CONFLICT (key) DO UPDATE
      SET
        count = CASE
          WHEN app_rate_limits.reset_at <= NOW() THEN 1
          ELSE app_rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN app_rate_limits.reset_at <= NOW() THEN NOW() + ($2 * INTERVAL '1 millisecond')
          ELSE app_rate_limits.reset_at
        END,
        updated_at = NOW()
      RETURNING
        count::int AS count,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - NOW()))))::int AS retry_after_seconds
    `,
    cacheKey,
    windowMs
  );

  if (Math.random() < 0.01) {
    void prisma.$executeRawUnsafe(
      "DELETE FROM app_rate_limits WHERE reset_at <= NOW()"
    ).catch((error) => {
      console.error("[RATE_LIMIT] cleanup failed:", error);
    });
  }

  const row = rows[0];
  return {
    count: toSafeNumber(row?.count, 1),
    retryAfterSeconds: Math.max(1, toSafeNumber(row?.retry_after_seconds, 1)),
  };
}

function consumeFallbackRateLimit(
  cacheKey: string,
  windowMs: number
): RateLimitDecision {
  const now = Date.now();

  for (const [storedKey, entry] of fallbackRateLimitHits) {
    if (entry.resetAt <= now) {
      fallbackRateLimitHits.delete(storedKey);
    }
  }

  const current = fallbackRateLimitHits.get(cacheKey);

  if (!current || current.resetAt <= now) {
    fallbackRateLimitHits.set(cacheKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      count: 1,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  current.count += 1;
  fallbackRateLimitHits.set(cacheKey, current);

  return {
    count: current.count,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

function createRateLimiter({
  keyPrefix,
  windowMs,
  max,
  keyFn,
}: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey =
      keyFn?.(req) || req.ip || req.socket.remoteAddress || "unknown";
    const normalizedKey = rawKey.trim().toLowerCase() || "unknown";
    const cacheKey = `${keyPrefix}:${normalizedKey}`;

    let decision: RateLimitDecision;
    try {
      decision = await consumeDistributedRateLimit(cacheKey, windowMs);
    } catch (error) {
      if (!warnedAboutRateLimitFallback) {
        warnedAboutRateLimitFallback = true;
        console.error(
          "[RATE_LIMIT] failed to use distributed store, falling back to in-memory limiter:",
          error
        );
      }
      decision = consumeFallbackRateLimit(cacheKey, windowMs);
    }

    if (decision.count > max) {
      res.setHeader("Retry-After", String(decision.retryAfterSeconds));
      return res.status(429).json({
        message: "Muitas tentativas. Aguarde antes de tentar novamente.",
      });
    }

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
    "[RATE_LIMIT] usando Postgres para contagem compartilhada entre instancias, com fallback local se o store falhar."
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
