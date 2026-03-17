const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSubscriptionRenewalUrl,
} = require("../src/modules/billing/renewal");

test("buildSubscriptionRenewalUrl reuses the public signup flow with email and plan", () => {
  const url = buildSubscriptionRenewalUrl({
    baseUrl: "https://site.vouchercard.com.br",
    email: " Agency@Example.com ",
    planCode: "ANNUAL",
  });

  assert.equal(
    url,
    "https://site.vouchercard.com.br/cadastro?plan=ANNUAL&email=agency%40example.com&reason=subscription_expired"
  );
});

test("buildSubscriptionRenewalUrl returns null when the site url is missing", () => {
  const url = buildSubscriptionRenewalUrl({
    baseUrl: "   ",
    email: "agency@example.com",
  });

  assert.equal(url, null);
});
