import { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AsaasClient } from "./asaas.client";

type ReconciliationDbClient = typeof prisma;

type CheckoutReconciliationCandidate = {
  id: string;
  agencyId: string;
  provider: string;
  status: SubscriptionStatus;
  providerCheckoutId: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  activatedAt: Date | null;
  canceledAt: Date | null;
  checkoutExpiresAt: Date | null;
  agency: {
    id: string;
    isActive: boolean;
    asaasCustomerId: string | null;
  };
};

type CheckoutLookupClient = Pick<
  AsaasClient,
  "findActiveSubscriptionByCheckoutSession" | "listSubscriptionPayments"
>;

const checkoutReconciliationSelect = {
  id: true,
  agencyId: true,
  provider: true,
  status: true,
  providerCheckoutId: true,
  providerCustomerId: true,
  providerSubscriptionId: true,
  activatedAt: true,
  canceledAt: true,
  checkoutExpiresAt: true,
  agency: {
    select: {
      id: true,
      isActive: true,
      asaasCustomerId: true,
    },
  },
} as const;

export function isCheckoutReconciliationEligible(
  subscription: CheckoutReconciliationCandidate,
  now: Date = new Date()
) {
  const checkoutId = subscription.providerCheckoutId?.trim();

  if (subscription.provider !== "ASAAS" || !checkoutId) {
    return false;
  }

  const alreadySynchronized =
    subscription.status === SubscriptionStatus.ACTIVE &&
    !!subscription.activatedAt &&
    !!subscription.providerSubscriptionId?.trim() &&
    subscription.agency.isActive;

  if (alreadySynchronized) {
    return false;
  }

  if (
    subscription.checkoutExpiresAt &&
    subscription.checkoutExpiresAt.getTime() + 15 * 60_000 <= now.getTime() &&
    subscription.status !== SubscriptionStatus.ACTIVE
  ) {
    return false;
  }

  return true;
}

export function hasConfirmedSubscriptionPayment(
  payments: Array<{ status?: string | null }>
) {
  return payments.some((payment) => {
    const status = String(payment.status ?? "").trim().toUpperCase();
    return status === "CONFIRMED" || status === "RECEIVED";
  });
}

export async function reconcileSignupSessionCheckout(
  publicToken: string,
  db: ReconciliationDbClient = prisma,
  checkoutClient: CheckoutLookupClient = new AsaasClient(),
  now: Date = new Date()
) {
  const normalizedToken = String(publicToken ?? "").trim();

  if (!normalizedToken) {
    return false;
  }

  const subscription = await db.agencySubscription.findUnique({
    where: { publicToken: normalizedToken },
    select: checkoutReconciliationSelect,
  });

  return reconcileSubscriptionCheckout(subscription, db, checkoutClient, now);
}

export async function reconcileAgencyCheckoutAccess(
  agencyId: string,
  db: ReconciliationDbClient = prisma,
  checkoutClient: CheckoutLookupClient = new AsaasClient(),
  now: Date = new Date()
) {
  const normalizedAgencyId = String(agencyId ?? "").trim();

  if (!normalizedAgencyId) {
    return false;
  }

  const subscription = await db.agencySubscription.findFirst({
    where: {
      agencyId: normalizedAgencyId,
      provider: "ASAAS",
      providerCheckoutId: { not: null },
    },
    orderBy: [{ createdAt: "desc" }],
    select: checkoutReconciliationSelect,
  });

  return reconcileSubscriptionCheckout(subscription, db, checkoutClient, now);
}

async function reconcileSubscriptionCheckout(
  subscription: CheckoutReconciliationCandidate | null,
  db: ReconciliationDbClient,
  checkoutClient: CheckoutLookupClient,
  now: Date
) {
  if (!subscription || !isCheckoutReconciliationEligible(subscription, now)) {
    return false;
  }

  try {
    const remoteSubscription =
      await checkoutClient.findActiveSubscriptionByCheckoutSession(
        subscription.providerCheckoutId!.trim()
      );

    const remoteSubscriptionId = remoteSubscription?.id?.trim();
    if (!remoteSubscriptionId) {
      return false;
    }

    const remotePayments =
      await checkoutClient.listSubscriptionPayments(remoteSubscriptionId);

    if (!hasConfirmedSubscriptionPayment(remotePayments)) {
      return false;
    }

    const resolvedCustomerId =
      remoteSubscription?.customer?.trim() ||
      subscription.providerCustomerId?.trim() ||
      subscription.agency.asaasCustomerId?.trim() ||
      null;

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.agencySubscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          providerCustomerId: resolvedCustomerId ?? undefined,
          providerSubscriptionId: remoteSubscriptionId,
          activatedAt: subscription.activatedAt ?? now,
          canceledAt: null,
          lastEventAt: now,
        },
      });

      await tx.agency.update({
        where: { id: subscription.agencyId },
        data: {
          isActive: true,
          asaasCustomerId: resolvedCustomerId ?? undefined,
        },
      });
    });

    return true;
  } catch (error) {
    console.error(
      "[ASAAS] Falha ao reconciliar checkout pago antes do webhook:",
      error
    );
    return false;
  }
}
