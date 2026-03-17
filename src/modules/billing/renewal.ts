import { getSubscriptionPlan } from "./plans";

type BuildSubscriptionRenewalUrlInput = {
  baseUrl?: string | null;
  email?: string | null;
  planCode?: string | null;
  reason?: string | null;
};

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
    const url = new URL("cadastro", ensureTrailingSlash(rawBaseUrl));
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
