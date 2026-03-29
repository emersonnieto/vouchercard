import nodemailer from "nodemailer";

export class SupportValidationError extends Error {}

type SendSupportContactInput = {
  email: unknown;
  message: unknown;
  ip?: string;
  origin?: string;
  userAgent?: string;
};

type NormalizedSupportContactInput = {
  email: string;
  message: string;
};

type SupportMailConfig = {
  inboxEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
};

export function normalizeSupportContactInput(
  input: Pick<SendSupportContactInput, "email" | "message">
): NormalizedSupportContactInput {
  const email = String(input.email ?? "").trim().toLowerCase();
  const message = String(input.message ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SupportValidationError("Informe um email valido.");
  }

  if (message.length < 8) {
    throw new SupportValidationError("Escreva uma mensagem com pelo menos 8 caracteres.");
  }

  if (message.length > 5000) {
    throw new SupportValidationError("A mensagem excedeu o limite permitido.");
  }

  return { email, message };
}

export function readSupportMailConfig(
  env: NodeJS.ProcessEnv = process.env
): SupportMailConfig {
  const smtpHost = String(env.SMTP_HOST ?? "").trim();
  const smtpPort = Number(String(env.SMTP_PORT ?? "465").trim() || "465");
  const smtpSecure = String(env.SMTP_SECURE ?? "true").trim().toLowerCase() !== "false";
  const smtpUser = String(env.SMTP_USER ?? "").trim();
  const smtpPass = String(env.SMTP_PASS ?? "").trim();
  const inboxEmail = String(env.SUPPORT_INBOX_EMAIL ?? smtpUser).trim();

  if (!smtpHost || !smtpUser || !smtpPass || !inboxEmail || !Number.isFinite(smtpPort)) {
    throw new Error(
      "Configuracao de email indisponivel. Revise SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SUPPORT_INBOX_EMAIL."
    );
  }

  return {
    inboxEmail,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
  };
}

export function buildSupportEmailText(
  input: NormalizedSupportContactInput & {
    ip?: string;
    origin?: string;
    userAgent?: string;
  }
) {
  return [
    "Novo contato pela pagina de suporte do VoucherCard.",
    "",
    `Email para resposta: ${input.email}`,
    `IP: ${input.ip || "nao informado"}`,
    `Origem: ${input.origin || "nao informada"}`,
    `User-Agent: ${input.userAgent || "nao informado"}`,
    "",
    "Mensagem:",
    input.message,
  ].join("\n");
}

export async function sendSupportContactEmail(input: SendSupportContactInput) {
  const normalized = normalizeSupportContactInput(input);
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

  const info = await transporter.sendMail({
    from: `"VoucherCard Suporte" <${config.smtpUser}>`,
    to: config.inboxEmail,
    replyTo: normalized.email,
    subject: "Novo contato de suporte - VoucherCard",
    text: buildSupportEmailText({
      ...normalized,
      ip: input.ip,
      origin: input.origin,
      userAgent: input.userAgent,
    }),
  });

  return {
    accepted: info.accepted,
    messageId: info.messageId,
  };
}
