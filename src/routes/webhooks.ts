import { Request, Response } from "express";
import {
  BillingUnauthorizedError,
  BillingValidationError,
  handleAsaasWebhookEvent,
} from "../modules/billing/billing.service";

export async function handleAsaasWebhook(req: Request, res: Response) {
  try {
    const authToken = req.header("asaas-access-token") ?? undefined;
    const result = await handleAsaasWebhookEvent(
      (req.body ?? {}) as Record<string, unknown>,
      authToken
    );

    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    if (error instanceof BillingUnauthorizedError) {
      return res.status(401).json({ message: error.message });
    }

    if (error instanceof BillingValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error("[ASAAS] webhook failed:", error);
    return res.status(500).json({ message: "Erro interno." });
  }
}
