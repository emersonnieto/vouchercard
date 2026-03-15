import { Request, Response, NextFunction } from "express";
import { verifyJwt, AppJwtPayload, UserRole } from "../auth/jwt";
import { ensureAgencySubscriptionAccess } from "../modules/billing/subscriptionAccess";

export type AuthUser = {
  userId: string;
  agencyId?: string | null;
  role: UserRole;
};

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.header("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente" });
  }

  const token = authHeader.replace("Bearer ", "").trim();

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
