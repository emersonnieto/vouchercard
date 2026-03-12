const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidCpfCnpj,
  sanitizeDigits,
  slugifyAgencyName,
  mapAsaasEventToStatus,
} = require("../src/modules/billing/billing.utils");
const { getSubscriptionPlan } = require("../src/modules/billing/plans");

test("sanitizeDigits removes non numeric characters", () => {
  assert.equal(sanitizeDigits("12.345-67/890"), "1234567890");
});

test("isValidCpfCnpj validates CPF and rejects invalid document", () => {
  assert.equal(isValidCpfCnpj("52998224725"), true);
  assert.equal(isValidCpfCnpj("12345678901"), false);
});

test("slugifyAgencyName normalizes accents and symbols", () => {
  assert.equal(
    slugifyAgencyName("Agencia Sao Joao & Filhos"),
    "agencia-sao-joao-filhos"
  );
});

test("getSubscriptionPlan resolves supported plans", () => {
  const annual = getSubscriptionPlan("annual");

  assert.equal(annual.code, "ANNUAL");
  assert.equal(annual.monthlyPrice, 179.9);
});

test("mapAsaasEventToStatus activates only successful payment events", () => {
  assert.equal(mapAsaasEventToStatus("PAYMENT_CONFIRMED").activateAgency, true);
  assert.equal(mapAsaasEventToStatus("PAYMENT_OVERDUE").activateAgency, false);
  assert.equal(mapAsaasEventToStatus("UNKNOWN_EVENT"), null);
});
