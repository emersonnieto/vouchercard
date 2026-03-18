const test = require("node:test");
const assert = require("node:assert/strict");
const { SubscriptionStatus } = require("@prisma/client");

const {
  mapAsaasEventToStatus,
  resolveAsaasSubscriptionState,
} = require("../src/modules/billing/billing.utils");

test("resolveAsaasSubscriptionState keeps active access when PAYMENT_CREATED arrives after activation", () => {
  const decision = mapAsaasEventToStatus("PAYMENT_CREATED");
  const now = new Date("2026-03-18T02:20:07.529Z");

  const result = resolveAsaasSubscriptionState({
    currentStatus: SubscriptionStatus.ACTIVE,
    activatedAt: new Date("2026-03-18T01:15:22.562Z"),
    canceledAt: null,
    eventName: "PAYMENT_CREATED",
    incomingStatus: decision.status,
    activateAgency: decision.activateAgency,
    now,
  });

  assert.equal(result.nextStatus, SubscriptionStatus.ACTIVE);
  assert.equal(result.nextAgencyActive, true);
  assert.equal(result.shouldPreserveActiveAccess, true);
  assert.equal(result.nextCanceledAt, null);
});

test("resolveAsaasSubscriptionState still keeps pending checkout inactive before payment confirmation", () => {
  const decision = mapAsaasEventToStatus("PAYMENT_CREATED");
  const now = new Date("2026-03-18T00:23:40.197Z");

  const result = resolveAsaasSubscriptionState({
    currentStatus: SubscriptionStatus.CHECKOUT_CREATED,
    activatedAt: null,
    canceledAt: null,
    eventName: "PAYMENT_CREATED",
    incomingStatus: decision.status,
    activateAgency: decision.activateAgency,
    now,
  });

  assert.equal(result.nextStatus, SubscriptionStatus.CHECKOUT_CREATED);
  assert.equal(result.nextAgencyActive, false);
  assert.equal(result.shouldPreserveActiveAccess, false);
});

test("resolveAsaasSubscriptionState schedules cancellation at period end without dropping active access", () => {
  const decision = mapAsaasEventToStatus("PAYMENT_DELETED");
  const now = new Date("2026-03-17T23:15:19.905Z");

  const result = resolveAsaasSubscriptionState({
    currentStatus: SubscriptionStatus.ACTIVE,
    activatedAt: new Date("2026-03-15T14:31:04.061Z"),
    canceledAt: null,
    eventName: "PAYMENT_DELETED",
    incomingStatus: decision.status,
    activateAgency: decision.activateAgency,
    now,
  });

  assert.equal(result.nextStatus, SubscriptionStatus.ACTIVE);
  assert.equal(result.nextAgencyActive, true);
  assert.equal(result.shouldScheduleCancellation, true);
  assert.equal(result.nextCanceledAt?.toISOString(), now.toISOString());
});
