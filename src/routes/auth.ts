import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { runWithRlsContext } from "../lib/rls";
import { signJwt } from "../auth/jwt";
import {
  readSuperadminEmailAllowlist,
  resolveLoginUserRole,
} from "../auth/userRoles";
import { requireAuth, AuthedRequest } from "../middlewares/requireAuth";
import { ensureAgencySubscriptionAccess } from "../modules/billing/subscriptionAccess";
import { reconcileAgencyCheckoutAccess } from "../modules/billing/checkoutReconciliation";
import {
  buildSubscriptionRenewalUrl,
  signRenewalAccessToken,
} from "../modules/billing/renewal";
import {
  PasswordResetTokenError,
  PasswordResetUnavailableError,
  PasswordResetValidationError,
  requestPasswordReset,
  resetPasswordWithToken,
} from "../modules/auth/passwordReset.service";

export const authRouter = Router();

const allowedSuperadminEmails = readSuperadminEmailAllowlist(
  process.env.SUPERADMIN_EMAILS
);

/**
 * POST /auth/login
 * body: { email: string, password: string }
 */
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email e obrigatorio" });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "password e obrigatorio" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        agencyId: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Credenciais invalidas" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Credenciais invalidas" });
    }

    const role = resolveLoginUserRole({
      dbRole: user.role,
      email: user.email,
      allowedSuperadminEmails,
    });

    if (role !== "SUPERADMIN") {
      const agencyId = user.agencyId ? String(user.agencyId) : "";
      if (!agencyId) {
        return res.status(403).json({
          message: "Usuario sem agencia vinculada. Contate o suporte.",
        });
      }

      let agencyAccess = await ensureAgencySubscriptionAccess(agencyId);

      if (agencyAccess.agencyFound && !agencyAccess.isActive) {
        const reconciled = await reconcileAgencyCheckoutAccess(agencyId);
        if (reconciled) {
          agencyAccess = await ensureAgencySubscriptionAccess(agencyId);
        }
      }

      if (!agencyAccess.agencyFound || !agencyAccess.isActive) {
        const isSubscriptionExpired = agencyAccess.expiredBySchedule;
        const canOfferRenewal = agencyAccess.agencyFound;
        const renewalToken = canOfferRenewal
          ? signRenewalAccessToken({
              type: "billing-renewal",
              userId: user.id,
              agencyId,
              email: user.email,
            })
          : null;

        return res.status(403).json({
          message: isSubscriptionExpired
            ? "Assinatura expirada. Renove para voltar a acessar o painel."
            : "Agencia inativa. Reative a assinatura para voltar a acessar o painel.",
          code: isSubscriptionExpired
            ? "SUBSCRIPTION_EXPIRED"
            : "AGENCY_INACTIVE",
          renewal: canOfferRenewal
            ? {
                url: buildSubscriptionRenewalUrl({
                  email: user.email,
                  planCode: agencyAccess.planCode,
                  reason: isSubscriptionExpired
                    ? "subscription_expired"
                    : "agency_inactive",
                  token: renewalToken,
                }),
                token: renewalToken,
                email: user.email,
                planCode: agencyAccess.planCode,
                expiresAt: agencyAccess.expiresAt,
              }
            : undefined,
        });
      }
    }

    const token = signJwt({
      userId: user.id,
      agencyId: user.agencyId ?? null,
      role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        agencyId: user.agencyId,
        name: user.name,
        email: user.email,
        role,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * POST /auth/forgot-password
 * body: { email: string }
 */
authRouter.post("/forgot-password", async (req, res) => {
  try {
    const result = await requestPasswordReset(req.body?.email);
    return res.json(result);
  } catch (e) {
    if (e instanceof PasswordResetValidationError) {
      return res.status(400).json({ message: e.message });
    }

    if (e instanceof PasswordResetUnavailableError) {
      return res.status(503).json({
        message: "Recuperacao de senha indisponivel no momento.",
      });
    }

    console.error(e);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * POST /auth/reset-password
 * body: { token: string, newPassword: string }
 */
authRouter.post("/reset-password", async (req, res) => {
  try {
    const result = await resetPasswordWithToken({
      token: req.body?.token,
      newPassword: req.body?.newPassword,
    });
    return res.json(result);
  } catch (e) {
    if (
      e instanceof PasswordResetValidationError ||
      e instanceof PasswordResetTokenError
    ) {
      return res.status(400).json({ message: e.message });
    }

    console.error(e);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * POST /auth/change-password
 * Header: Authorization: Bearer <token>
 * body: { currentPassword: string, newPassword: string }
 */
authRouter.post(
  "/change-password",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const authUser = req.user;
      const userId = authUser?.userId;
      if (!authUser || !userId) {
        return res.status(401).json({ message: "Nao autorizado" });
      }

      const { currentPassword, newPassword } = req.body ?? {};

      if (!currentPassword || typeof currentPassword !== "string") {
        return res
          .status(400)
          .json({ message: "currentPassword e obrigatorio" });
      }

      if (
        !newPassword ||
        typeof newPassword !== "string" ||
        newPassword.length < 6
      ) {
        return res
          .status(400)
          .json({ message: "newPassword e obrigatorio (min 6)" });
      }

      const user: { id: string; passwordHash: string } | null =
        await runWithRlsContext(authUser, (db) =>
          db.user.findUnique({
          where: { id: userId },
          select: { id: true, passwordHash: true },
          })
        );

      if (!user) {
        return res.status(404).json({ message: "Usuario nao encontrado" });
      }

      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ message: "Senha atual incorreta" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await runWithRlsContext(authUser, (db) =>
        db.user.update({
          where: { id: userId },
          data: { passwordHash },
        })
      );

      return res.json({ message: "Senha atualizada com sucesso" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Erro interno" });
    }
  }
);
