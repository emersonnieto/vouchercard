const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSubscriptionRenewalUrl,
  signRenewalAccessToken,
  verifyRenewalAccessToken,
} = require("../src/modules/billing/renewal");

test.beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-for-suite";
});

test("buildSubscriptionRenewalUrl reuses the public signup flow with email and plan", () => {
  const url = buildSubscriptionRenewalUrl({
    baseUrl: "https://site.vouchercard.com.br",
    email: " Agency@Example.com ",
    planCode: "ANNUAL",
    token: "renew-token-123",
  });

  assert.equal(
    url,
    "https://site.vouchercard.com.br/renovar-assinatura?plan=ANNUAL&email=agency%40example.com&token=renew-token-123&reason=subscription_expired"
  );
});

test("buildSubscriptionRenewalUrl returns null when the site url is missing", () => {
  const url = buildSubscriptionRenewalUrl({
    baseUrl: "   ",
    email: "agency@example.com",
  });

  assert.equal(url, null);
});

test("renewal access token round-trips the expected payload", () => {
  const token = signRenewalAccessToken({
    type: "billing-renewal",
    userId: "user-1",
    agencyId: "agency-1",
    email: "agency@example.com",
  });

  const payload = verifyRenewalAccessToken(token);

  assert.equal(payload.type, "billing-renewal");
  assert.equal(payload.userId, "user-1");
  assert.equal(payload.agencyId, "agency-1");
  assert.equal(payload.email, "agency@example.com");
});
