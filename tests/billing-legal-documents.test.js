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
  assert.equal(bundle.document.version, "2026-03-26");
  assert.equal(bundle.document.publicUrl, "https://termosdeuso.vouchercard.com.br/");
  assert.equal(bundle.document.hash.length, 64);
  assert.equal(bundle.bundleHash.length, 64);
});

test("isBillingLegalAcceptanceValid accepts the exact current bundle", () => {
  const bundle = getCurrentBillingLegalDocuments("signup");

  const valid = isBillingLegalAcceptanceValid("signup", {
    statement: bundle.statement,
    documentVersion: bundle.document.version,
    documentHash: bundle.document.hash,
    bundleHash: bundle.bundleHash,
  });

  assert.equal(valid, true);
});

test("isBillingLegalAcceptanceValid rejects tampered data", () => {
  const bundle = getCurrentBillingLegalDocuments("signup");

  const valid = isBillingLegalAcceptanceValid("signup", {
    statement: bundle.statement,
    documentVersion: bundle.document.version,
    documentHash: `${bundle.document.hash.slice(0, -1)}0`,
    bundleHash: bundle.bundleHash,
  });

  assert.equal(valid, false);
});
