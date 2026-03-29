const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSupportEmailText,
  normalizeSupportContactInput,
  readSupportMailConfig,
  SupportValidationError,
} = require("../src/modules/support/support.service");

test("normalizeSupportContactInput normalizes a valid payload", () => {
  const payload = normalizeSupportContactInput({
    email: "  Cliente@Example.com ",
    message: "Preciso de ajuda com minha assinatura.",
  });

  assert.deepEqual(payload, {
    email: "cliente@example.com",
    message: "Preciso de ajuda com minha assinatura.",
  });
});

test("normalizeSupportContactInput rejects invalid email", () => {
  assert.throws(
    () =>
      normalizeSupportContactInput({
        email: "email-invalido",
        message: "Mensagem valida com tamanho suficiente.",
      }),
    SupportValidationError
  );
});

test("buildSupportEmailText includes sender and message metadata", () => {
  const text = buildSupportEmailText({
    email: "cliente@example.com",
    message: "Mensagem de teste.",
    ip: "127.0.0.1",
    origin: "https://vouchercard.com.br",
    userAgent: "test-agent",
  });

  assert.match(text, /cliente@example\.com/);
  assert.match(text, /127\.0\.0\.1/);
  assert.match(text, /Mensagem de teste\./);
});

test("readSupportMailConfig falls back to SMTP_USER as inbox", () => {
  const config = readSupportMailConfig({
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "enbtechsolutions@gmail.com",
    SMTP_PASS: "app-password",
  });

  assert.equal(config.inboxEmail, "enbtechsolutions@gmail.com");
  assert.equal(config.smtpPort, 465);
  assert.equal(config.smtpSecure, true);
});
