const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getCurrentBillingLegalDocuments,
  isBillingLegalAcceptanceValid,
} = require("../src/modules/billing/legalDocuments");

test("getCurrentBillingLegalDocuments returns the current signup bundle", () => {
  const bundle = getCurrentBillingLegalDocuments("signup");

  assert.equal(bundle.kind, "signup");
  assert.equal(typeof bundle.statement, "string");
  assert.ok(bundle.statement.includes("inicio da assinatura recorrente"));
  assert.equal(bundle.terms.version, "2026-03-26");
  assert.equal(bundle.privacyPolicy.version, "2026-03-26");
  assert.equal(bundle.terms.hash.length, 64);
  assert.equal(bundle.privacyPolicy.hash.length, 64);
  assert.equal(bundle.bundleHash.length, 64);
});

test("isBillingLegalAcceptanceValid accepts the exact current bundle", () => {
  const bundle = getCurrentBillingLegalDocuments("signup");

  const valid = isBillingLegalAcceptanceValid("signup", {
    statement: bundle.statement,
    termsVersion: bundle.terms.version,
    termsHash: bundle.terms.hash,
    privacyVersion: bundle.privacyPolicy.version,
    privacyHash: bundle.privacyPolicy.hash,
    bundleHash: bundle.bundleHash,
  });

  assert.equal(valid, true);
});

test("isBillingLegalAcceptanceValid rejects tampered data", () => {
  const bundle = getCurrentBillingLegalDocuments("signup");

  const valid = isBillingLegalAcceptanceValid("signup", {
    statement: bundle.statement,
    termsVersion: bundle.terms.version,
    termsHash: `${bundle.terms.hash.slice(0, -1)}0`,
    privacyVersion: bundle.privacyPolicy.version,
    privacyHash: bundle.privacyPolicy.hash,
    bundleHash: bundle.bundleHash,
  });

  assert.equal(valid, false);
});
