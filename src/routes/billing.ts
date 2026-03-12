import { Router } from "express";
import {
  BillingIntegrationError,
  BillingValidationError,
  createAgencySignup,
  getPublicPlans,
  getSignupSession,
} from "../modules/billing/billing.service";

export const billingRouter = Router();

billingRouter.get("/plans", (_req, res) => {
  return res.json({
    plans: getPublicPlans(),
  });
});

billingRouter.post("/signup", async (req, res) => {
  try {
    const result = await createAgencySignup(req.body ?? {});
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
