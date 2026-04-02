import { createHash, randomBytes } from "crypto";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { prisma } from "../../lib/prisma";
import { readSupportMailConfig } from "../support/support.service";

export class PasswordResetValidationError extends Error {}
export class PasswordResetUnavailableError extends Error {}
export class PasswordResetTokenError extends Error {}

export const PASSWORD_RESET_REQUEST_MESSAGE =
  "Se existir uma conta com esse email, enviaremos um link de recuperacao.";
export const PASSWORD_RESET_INVALID_TOKEN_MESSAGE =
  "Link de recuperacao invalido ou expirado.";

const DEFAULT_PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function readPasswordResetTokenTtlMs(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.PASSWORD_RESET_TOKEN_TTL_MS ?? "").trim();
  if (!raw) {
    return DEFAULT_PASSWORD_RESET_TOKEN_TTL_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PasswordResetUnavailableError(
      "PASSWORD_RESET_TOKEN_TTL_MS deve ser um inteiro positivo."
    );
  }

  return Math.floor(parsed);
}

export function normalizePasswordResetEmail(input: unknown) {
  const email = String(input ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PasswordResetValidationError("Informe um email valido.");
  }

  return email;
}

export function normalizePasswordResetToken(input: unknown) {
  const token = String(input ?? "").trim().toLowerCase();

  if (!/^[a-f0-9]{32,}$/.test(token)) {
    throw new PasswordResetTokenError(PASSWORD_RESET_INVALID_TOKEN_MESSAGE);
  }

  return token;
}

export function normalizePasswordResetPassword(input: unknown) {
  const password = String(input ?? "");

  if (!password.trim()) {
    throw new PasswordResetValidationError("newPassword e obrigatorio");
  }

  if (password.length < 6) {
    throw new PasswordResetValidationError(
      "A nova senha precisa ter no minimo 6 caracteres."
    );
  }

  return password;
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readAdminAppUrl(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.ADMIN_APP_URL ?? "").trim();

  if (!raw) {
    throw new PasswordResetUnavailableError(
      "ADMIN_APP_URL nao configurada para o fluxo de recuperacao de senha."
    );
  }

  try {
    return new URL(raw);
  } catch {
    throw new PasswordResetUnavailableError(
      "ADMIN_APP_URL invalida para o fluxo de recuperacao de senha."
    );
  }
}

export function buildPasswordResetUrl(input: {
  token: string;
  baseUrl?: string;
}) {
  const url = new URL("/reset-password", input.baseUrl ?? readAdminAppUrl().toString());
  url.searchParams.set("token", input.token);
  return url.toString();
}

function buildPasswordResetEmailText(input: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const firstName = input.name.trim().split(/\s+/)[0] || "usuario";

  return [
    `Ola, ${firstName}.`,
    "",
    "Recebemos um pedido para redefinir a senha do seu acesso ao admin VoucherCard.",
    `Use o link abaixo em ate ${input.expiresInMinutes} minutos:`,
    input.resetUrl,
    "",
    "Se voce nao solicitou essa alteracao, ignore este email.",
  ].join("\n");
}

async function sendPasswordResetEmail(input: {
  email: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const config = readSupportMailConfig();

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"VoucherCard" <${config.smtpUser}>`,
    to: input.email,
    subject: "Recuperacao de senha - VoucherCard",
    text: buildPasswordResetEmailText(input),
  });
}

function ensurePasswordResetInfra() {
  readSupportMailConfig();
  const adminAppUrl = readAdminAppUrl();
  const tokenTtlMs = readPasswordResetTokenTtlMs();

  return {
    adminAppUrl,
    tokenTtlMs,
  };
}

export async function requestPasswordReset(emailInput: unknown) {
  const email = normalizePasswordResetEmail(emailInput);
  const { adminAppUrl, tokenTtlMs } = ensurePasswordResetInfra();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return { message: PASSWORD_RESET_REQUEST_MESSAGE };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + tokenTtlMs);

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  const createdToken = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
    select: {
      id: true,
    },
  });

  try {
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl: buildPasswordResetUrl({
        token,
        baseUrl: adminAppUrl.toString(),
      }),
      expiresInMinutes: Math.max(1, Math.floor(tokenTtlMs / 60000)),
    });
  } catch (error) {
    await prisma.passwordResetToken
      .delete({
        where: { id: createdToken.id },
      })
      .catch(() => undefined);

    throw new PasswordResetUnavailableError(
      "Falha ao enviar o email de recuperacao."
    );
  }

  return { message: PASSWORD_RESET_REQUEST_MESSAGE };
}

export async function resetPasswordWithToken(input: {
  token: unknown;
  newPassword: unknown;
}) {
  const token = normalizePasswordResetToken(input.token);
  const newPassword = normalizePasswordResetPassword(input.newPassword);
  const tokenHash = hashPasswordResetToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new PasswordResetTokenError(PASSWORD_RESET_INVALID_TOKEN_MESSAGE);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: record.userId,
        id: { not: record.id },
        usedAt: null,
      },
      data: { usedAt: now },
    }),
  ]);

  return { message: "Senha atualizada com sucesso." };
}
