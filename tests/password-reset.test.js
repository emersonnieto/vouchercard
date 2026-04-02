const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PasswordResetTokenError,
  PasswordResetValidationError,
  buildPasswordResetUrl,
  hashPasswordResetToken,
  normalizePasswordResetEmail,
  normalizePasswordResetPassword,
  normalizePasswordResetToken,
} = require("../src/modules/auth/passwordReset.service");

test("normalizePasswordResetEmail trims and lowercases", () => {
  assert.equal(
    normalizePasswordResetEmail("  Admin@Example.COM "),
    "admin@example.com"
  );
});

test("normalizePasswordResetEmail rejects invalid emails", () => {
  assert.throws(
    () => normalizePasswordResetEmail("email-invalido"),
    PasswordResetValidationError
  );
});

test("buildPasswordResetUrl appends the token to the reset route", () => {
  const url = buildPasswordResetUrl({
    token: "abc123token",
    baseUrl: "https://admin.vouchercard.com.br",
  });

  assert.equal(
    url,
    "https://admin.vouchercard.com.br/reset-password?token=abc123token"
  );
});

test("hashPasswordResetToken is deterministic and does not expose the raw token", () => {
  const token = "abcd1234";
  const firstHash = hashPasswordResetToken(token);
  const secondHash = hashPasswordResetToken(token);

  assert.equal(firstHash, secondHash);
  assert.notEqual(firstHash, token);
  assert.equal(firstHash.length, 64);
});

test("normalizePasswordResetToken rejects malformed tokens", () => {
  assert.throws(
    () => normalizePasswordResetToken("not-a-valid-token"),
    PasswordResetTokenError
  );
});

test("normalizePasswordResetPassword enforces minimum length", () => {
  assert.throws(
    () => normalizePasswordResetPassword("12345"),
    PasswordResetValidationError
  );
});
