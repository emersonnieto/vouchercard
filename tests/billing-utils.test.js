const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidCpfCnpj,
  sanitizeDigits,
  slugifyAgencyName,
  mapAsaasEventToStatus,
} = require("../src/modules/billing/billing.utils");
const { getSubscriptionPlan } = require("../src/modules/billing/plans");
const {
  getSubscriptionExpiresAt,
  getSubscriptionAccessEndsAt,
  getNextSubscriptionBillingDate,
  hasSubscriptionAccessReachedEnd,
  hasSubscriptionReachedEnd,
} = require("../src/modules/billing/subscriptionAccess");

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
  assert.equal(mapAsaasEventToStatus("PAYMENT_AUTHORIZED").activateAgency, false);
  assert.equal(mapAsaasEventToStatus("PAYMENT_OVERDUE").activateAgency, false);
  assert.equal(mapAsaasEventToStatus("UNKNOWN_EVENT"), null);
});

test("getSubscriptionExpiresAt uses the commitment months for every plan", () => {
  const activatedAt = new Date("2026-01-10T12:00:00.000Z");
  const monthlyExpiration = getSubscriptionExpiresAt(activatedAt, 1);
  const semiannualExpiration = getSubscriptionExpiresAt(activatedAt, 6);
  const annualExpiration = getSubscriptionExpiresAt(activatedAt, 12);

  assert.equal(monthlyExpiration.toISOString(), "2026-02-10T12:00:00.000Z");
  assert.equal(semiannualExpiration.toISOString(), "2026-07-10T12:00:00.000Z");
  assert.equal(annualExpiration.toISOString(), "2027-01-10T12:00:00.000Z");
});

test("hasSubscriptionReachedEnd blocks access once the commitment window ends", () => {
  const activatedAt = new Date("2026-01-10T12:00:00.000Z");

  assert.equal(
    hasSubscriptionReachedEnd(
      activatedAt,
      1,
      new Date("2026-02-10T11:59:59.000Z")
    ),
    false
  );
  assert.equal(
    hasSubscriptionReachedEnd(
      activatedAt,
      1,
      new Date("2026-02-10T12:00:00.000Z")
    ),
    true
  );
});

test("getNextSubscriptionBillingDate finds the first due date after the cancel request", () => {
  const activatedAt = new Date("2026-01-10T12:00:00.000Z");
  const canceledAt = new Date("2026-03-17T09:30:00.000Z");

  const nextDueDate = getNextSubscriptionBillingDate(activatedAt, 1, canceledAt);

  assert.equal(nextDueDate.toISOString(), "2026-04-10T12:00:00.000Z");
});

test("getSubscriptionAccessEndsAt uses the next billing cycle after cancellation", () => {
  const activatedAt = new Date("2026-01-10T12:00:00.000Z");
  const canceledAt = new Date("2026-03-17T09:30:00.000Z");

  const accessEndsAt = getSubscriptionAccessEndsAt({
    activatedAt,
    billingCycleMonths: 1,
    commitmentMonths: 12,
    canceledAt,
  });

  assert.equal(accessEndsAt.toISOString(), "2026-04-10T12:00:00.000Z");
});

test("hasSubscriptionAccessReachedEnd expires canceled subscriptions at the end of the paid cycle", () => {
  const activatedAt = new Date("2026-01-10T12:00:00.000Z");
  const canceledAt = new Date("2026-03-17T09:30:00.000Z");

  assert.equal(
    hasSubscriptionAccessReachedEnd(
      {
        activatedAt,
        billingCycleMonths: 1,
        commitmentMonths: 12,
        canceledAt,
      },
      new Date("2026-04-10T11:59:59.000Z")
    ),
    false
  );
  assert.equal(
    hasSubscriptionAccessReachedEnd(
      {
        activatedAt,
        billingCycleMonths: 1,
        commitmentMonths: 12,
        canceledAt,
      },
      new Date("2026-04-10T12:00:00.000Z")
    ),
    true
  );
});
