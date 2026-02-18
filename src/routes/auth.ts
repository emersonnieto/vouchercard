import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { signJwt } from "../auth/jwt";
import { requireAuth, AuthedRequest } from "../middlewares/requireAuth";

export const authRouter = Router();

/**
 * POST /auth/login
 * body: { email: string, password: string }
 */
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email é obrigatório" });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "password é obrigatório" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    // role vem do banco como string (ADMIN, SUPERADMIN etc)
    const role = user.role;

    // ⚠️ Se seu jwt.ts tipa role com union menor, o "as any" evita briga de TS.
const token = signJwt({
  userId: user.id,
  agencyId: user.agencyId,
  role: user.role as any, // pode manter assim se role for string no banco
});

    return res.json({
      token,
      user: {
        id: user.id,
        agencyId: user.agencyId,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * POST /auth/change-password
 * Header: Authorization: Bearer <token>
 * body: { currentPassword: string, newPassword: string }
 */
authRouter.post("/change-password", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { currentPassword, newPassword } = req.body ?? {};

    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({ message: "currentPassword é obrigatório" });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ message: "newPassword é obrigatório (mín 6)" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Senha atual incorreta" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return res.json({ message: "Senha atualizada com sucesso" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro interno" });
  }
});
