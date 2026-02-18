import { Response, NextFunction } from "express";
import { AuthedRequest } from "./requireAuth";

export function requireRole(allowed: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    return next();
  };
}
