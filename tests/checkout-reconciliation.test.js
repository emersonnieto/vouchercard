const test = require("node:test");
const assert = require("node:assert/strict");
const { SubscriptionStatus } = require("@prisma/client");

const {
  isCheckoutReconciliationEligible,
  hasConfirmedSubscriptionPayment,
} = require("../src/modules/billing/checkoutReconciliation");

function buildCandidate(overrides = {}) {
  return {
    id: "sub_1",
    agencyId: "agency_1",
    provider: "ASAAS",
    status: SubscriptionStatus.CHECKOUT_CREATED,
    providerCheckoutId: "chk_123",
    providerCustomerId: null,
    providerSubscriptionId: null,
    activatedAt: null,
    canceledAt: null,
    checkoutExpiresAt: new Date("2026-03-17T20:30:00.000Z"),
    agency: {
      id: "agency_1",
      isActive: false,
      asaasCustomerId: null,
    },
    ...overrides,
  };
}

test("isCheckoutReconciliationEligible allows recent checkout waiting sync", () => {
  const eligible = isCheckoutReconciliationEligible(
    buildCandidate(),
    new Date("2026-03-17T20:20:00.000Z")
  );

  assert.equal(eligible, true);
});

test("isCheckoutReconciliationEligible skips subscriptions already synchronized", () => {
  const eligible = isCheckoutReconciliationEligible(
    buildCandidate({
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: "sub_remote_1",
      activatedAt: new Date("2026-03-17T20:18:00.000Z"),
      agency: {
        id: "agency_1",
        isActive: true,
        asaasCustomerId: "cus_123",
      },
    }),
    new Date("2026-03-17T20:20:00.000Z")
  );

  assert.equal(eligible, false);
});

test("isCheckoutReconciliationEligible skips stale expired checkout sessions", () => {
  const eligible = isCheckoutReconciliationEligible(
    buildCandidate({
      checkoutExpiresAt: new Date("2026-03-17T19:00:00.000Z"),
    }),
    new Date("2026-03-17T20:20:00.000Z")
  );

  assert.equal(eligible, false);
});

test("isCheckoutReconciliationEligible requires Asaas checkout id", () => {
  const eligible = isCheckoutReconciliationEligible(
    buildCandidate({
      providerCheckoutId: null,
    }),
    new Date("2026-03-17T20:20:00.000Z")
  );

  assert.equal(eligible, false);
});

test("hasConfirmedSubscriptionPayment only accepts settled payment statuses", () => {
  assert.equal(
    hasConfirmedSubscriptionPayment([
      { status: "PENDING" },
      { status: "AWAITING_RISK_ANALYSIS" },
    ]),
    false
  );

  assert.equal(
    hasConfirmedSubscriptionPayment([
      { status: "CONFIRMED" },
      { status: "PENDING" },
    ]),
    true
  );

  assert.equal(
    hasConfirmedSubscriptionPayment([{ status: "RECEIVED" }]),
    true
  );
});
