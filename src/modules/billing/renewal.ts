import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import { getSubscriptionPlan } from "./plans";

type BuildSubscriptionRenewalUrlInput = {
  baseUrl?: string | null;
  email?: string | null;
  planCode?: string | null;
  reason?: string | null;
  token?: string | null;
};

export type RenewalAccessTokenPayload = JwtPayload & {
  type: "billing-renewal";
  userId: string;
  agencyId: string;
  email: string;
};

export function signRenewalAccessToken(
  payload: Omit<RenewalAccessTokenPayload, "iat" | "exp">,
  expiresIn: SignOptions["expiresIn"] = "30m"
) {
  return jwt.sign(payload as object, getJwtSecret(), { expiresIn });
}

export function verifyRenewalAccessToken(token: string) {
  const decoded = jwt.verify(token, getJwtSecret());

  if (typeof decoded === "string" || decoded.type !== "billing-renewal") {
    throw new Error("Token de renovacao invalido.");
  }

  return decoded as RenewalAccessTokenPayload;
}

export function buildSubscriptionRenewalUrl(
  input: BuildSubscriptionRenewalUrlInput = {}
) {
  const rawBaseUrl = String(
    input.baseUrl ?? process.env.FRONTEND_APP_URL ?? ""
  ).trim();

  if (!rawBaseUrl) {
    return null;
  }

  try {
    const url = new URL("renovar-assinatura", ensureTrailingSlash(rawBaseUrl));
    const normalizedEmail = String(input.email ?? "").trim().toLowerCase();
    const normalizedReason = String(
      input.reason ?? "subscription_expired"
    ).trim();
    const plan = getSubscriptionPlan(input.planCode);

    if (plan) {
      url.searchParams.set("plan", plan.code);
    }

    if (normalizedEmail) {
      url.searchParams.set("email", normalizedEmail);
    }

    if (input.token?.trim()) {
      url.searchParams.set("token", input.token.trim());
    }

    if (normalizedReason) {
      url.searchParams.set("reason", normalizedReason);
    }

    return url.toString();
  } catch {
    return null;
  }
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("JWT_SECRET nao configurado.");
  }

  return secret;
}
