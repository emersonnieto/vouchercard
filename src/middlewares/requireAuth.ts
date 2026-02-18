import { Request, Response, NextFunction } from "express";
import { verifyJwt, AppJwtPayload, UserRole } from "../auth/jwt";

/**
 * 👤 Usuário autenticado disponível na request
 */
export type AuthUser = {
  userId: string;
  agencyId?: string | null;
  role: UserRole; // ✅ agora aceita SUPERADMIN também
};

/**
 * 🔐 Extendendo Request do Express
 */
export interface AuthedRequest extends Request {
  user?: AuthUser;
}

/**
 * 🔒 Middleware de autenticação JWT
 */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
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

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}
