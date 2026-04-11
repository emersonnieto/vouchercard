import { Request, Response, NextFunction } from "express";
import { verifyJwt, AppJwtPayload, UserRole } from "../auth/jwt";
import { AUTH_COOKIE_NAME, readCookieValue } from "../auth/sessionCookie";
import { ensureAgencySubscriptionAccess } from "../modules/billing/subscriptionAccess";

export type AuthUser = {
  userId: string;
  agencyId?: string | null;
  role: UserRole;
};

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_ALLOWED_ORIGINS = [
  "https://vouchercard.com.br",
  "https://www.vouchercard.com.br",
  "https://admin.vouchercard.com.br",
];

function parseCsvEnv(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin.trim()).origin;
  } catch {
    return origin.trim().replace(/\/+$/, "");
  }
}

function getAllowedOrigins() {
  return new Set(
    [...parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS), ...DEFAULT_ALLOWED_ORIGINS]
      .map(normalizeOrigin)
      .filter(Boolean)
  );
}

function getRequestOrigin(req: Request) {
  const origin = req.header("origin");
  if (origin) return normalizeOrigin(origin);

  const referer = req.header("referer");
  if (!referer) return "";

  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

function isTrustedCookieAuthRequest(req: Request) {
  if (SAFE_METHODS.has((req.method ?? "GET").toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) {
    return process.env.NODE_ENV !== "production" && process.env.RENDER !== "true";
  }

  return getAllowedOrigins().has(requestOrigin);
}

function getBearerToken(req: Request) {
  const authHeader = req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.replace("Bearer ", "").trim();
}

function getSessionCookieToken(req: Request) {
  return readCookieValue(req.header("cookie"), AUTH_COOKIE_NAME).trim();
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const bearerToken = getBearerToken(req);
  const cookieToken = getSessionCookieToken(req);
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ message: "Token ausente" });
  }

  if (!bearerToken && cookieToken && !isTrustedCookieAuthRequest(req)) {
    return res.status(403).json({ message: "Origem nao permitida" });
  }

  try {
    const payload: AppJwtPayload = verifyJwt(token);

    req.user = {
      userId: payload.userId,
      agencyId: payload.agencyId ?? null,
      role: payload.role,
    };

    if (payload.role !== "SUPERADMIN") {
      const agencyAccess = await ensureAgencySubscriptionAccess(payload.agencyId);

      if (!agencyAccess.agencyFound) {
        return res.status(403).json({ message: "Usuario sem agencia vinculada." });
      }

      if (!agencyAccess.isActive) {
        return res.status(403).json({
          message: agencyAccess.expiredBySchedule
            ? "Assinatura expirada. Contate o suporte."
            : "Agencia inativa. Contate o suporte.",
        });
      }
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalido ou expirado" });
  }
}
