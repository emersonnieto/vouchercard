import { Router } from "express";
import {
  BillingIntegrationError,
  BillingValidationError,
  createAgencySignup,
  getPublicPlans,
  getRenewalPrefill,
  getSignupSession,
} from "../modules/billing/billing.service";
import { getCurrentBillingLegalDocuments } from "../modules/billing/legalDocuments";

export const billingRouter = Router();

billingRouter.get("/plans", (_req, res) => {
  return res.json({
    plans: getPublicPlans(),
  });
});

billingRouter.get("/legal-documents", (req, res) => {
  const kind = req.query.kind === "renewal" ? "renewal" : "signup";
  return res.json(getCurrentBillingLegalDocuments(kind));
});

billingRouter.post("/signup", async (req, res) => {
  try {
    const forwardedForHeader = req.header("x-forwarded-for") ?? "";
    const ipAddress = forwardedForHeader.split(",")[0]?.trim() || req.ip || "";
    const result = await createAgencySignup(req.body ?? {}, {
      ipAddress,
      userAgent: req.header("user-agent") ?? undefined,
      acceptLanguage: req.header("accept-language") ?? undefined,
      requestPath: req.originalUrl,
      origin: req.header("origin") ?? undefined,
      referer: req.header("referer") ?? undefined,
    });
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof BillingValidationError) {
      return res.status(400).json({ message: error.message });
    }

    if (error instanceof BillingIntegrationError) {
      return res.status(502).json({ message: error.message });
    }

    console.error("[BILLING] signup failed:", error);
    return res.status(500).json({ message: "Erro interno no cadastro." });
  }
});

billingRouter.get("/renewal-profile", async (req, res) => {
  try {
    const token = String(req.query.token ?? "").trim();
    if (!token) {
      return res.status(400).json({ message: "Token de renovacao invalido." });
    }

    const profile = await getRenewalPrefill(token);
    return res.json(profile);
  } catch (error) {
    if (error instanceof BillingValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error("[BILLING] renewal profile failed:", error);
    return res.status(500).json({ message: "Erro interno ao carregar a renovacao." });
  }
});

billingRouter.get("/sessions/:publicToken", async (req, res) => {
  try {
    const publicToken = String(req.params.publicToken ?? "").trim();
    if (!publicToken) {
      return res.status(400).json({ message: "Sessao invalida." });
    }

    const session = await getSignupSession(publicToken);
    if (!session) {
      return res.status(404).json({ message: "Sessao nao encontrada." });
    }

    return res.json(session);
  } catch (error) {
    console.error("[BILLING] session lookup failed:", error);
    return res.status(500).json({ message: "Erro interno." });
  }
});
