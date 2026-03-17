import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { addMonths } from "./billing.utils";
import type { SubscriptionPlanCode } from "./plans";

export type AgencySubscriptionAccessState = {
  agencyFound: boolean;
  isActive: boolean;
  expiredBySchedule: boolean;
  expiresAt: Date | null;
  planCode: SubscriptionPlanCode | null;
};

type SubscriptionAccessSnapshot = {
  id: string;
  agencyId: string;
  plan: SubscriptionPlanCode;
  activatedAt: Date | null;
  billingCycleMonths: number;
  commitmentMonths: number;
  canceledAt: Date | null;
};

export type SubscriptionExpirationSweepResult = {
  checkedActiveSubscriptions: number;
  expiredSubscriptions: number;
};

export function getSubscriptionExpiresAt(
  activatedAt: Date,
  commitmentMonths: number
) {
  return addMonths(activatedAt, commitmentMonths);
}

export function getNextSubscriptionBillingDate(
  activatedAt: Date,
  billingCycleMonths: number,
  referenceDate: Date
) {
  const cycleMonths = Math.max(1, billingCycleMonths);
  let nextDueDate = addMonths(activatedAt, cycleMonths);

  while (nextDueDate.getTime() <= referenceDate.getTime()) {
    nextDueDate = addMonths(nextDueDate, cycleMonths);
  }

  return nextDueDate;
}

export function getSubscriptionAccessEndsAt(input: {
  activatedAt: Date;
  billingCycleMonths: number;
  commitmentMonths: number;
  canceledAt?: Date | null;
}) {
  const commitmentEndsAt = getSubscriptionExpiresAt(
    input.activatedAt,
    input.commitmentMonths
  );

  if (!input.canceledAt) {
    return commitmentEndsAt;
  }

  const nextBillingDate = getNextSubscriptionBillingDate(
    input.activatedAt,
    input.billingCycleMonths,
    input.canceledAt
  );

  return nextBillingDate.getTime() <= commitmentEndsAt.getTime()
    ? nextBillingDate
    : commitmentEndsAt;
}

export function hasSubscriptionReachedEnd(
  activatedAt: Date,
  commitmentMonths: number,
  now: Date = new Date()
) {
  return getSubscriptionExpiresAt(activatedAt, commitmentMonths).getTime() <= now.getTime();
}

export function hasSubscriptionAccessReachedEnd(
  input: {
    activatedAt: Date;
    billingCycleMonths: number;
    commitmentMonths: number;
    canceledAt?: Date | null;
  },
  now: Date = new Date()
) {
  return getSubscriptionAccessEndsAt(input).getTime() <= now.getTime();
}

export async function ensureAgencySubscriptionAccess(
  agencyId: string | null | undefined,
  now: Date = new Date()
): Promise<AgencySubscriptionAccessState> {
  const normalizedAgencyId = String(agencyId ?? "").trim();

  if (!normalizedAgencyId) {
    return {
      agencyFound: false,
      isActive: false,
      expiredBySchedule: false,
      expiresAt: null,
      planCode: null,
    };
  }

  const [agency, activeSubscription, latestActivatedSubscription] = await Promise.all([
    prisma.agency.findUnique({
      where: { id: normalizedAgencyId },
      select: { id: true, isActive: true },
    }),
    prisma.agencySubscription.findFirst({
      where: {
        agencyId: normalizedAgencyId,
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        agencyId: true,
        plan: true,
        activatedAt: true,
        billingCycleMonths: true,
        commitmentMonths: true,
        canceledAt: true,
      },
    }),
    prisma.agencySubscription.findFirst({
      where: {
        agencyId: normalizedAgencyId,
        activatedAt: { not: null },
      },
      orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        agencyId: true,
        plan: true,
        activatedAt: true,
        billingCycleMonths: true,
        commitmentMonths: true,
        canceledAt: true,
      },
    }),
  ]);

  if (!agency) {
    return {
      agencyFound: false,
      isActive: false,
      expiredBySchedule: false,
      expiresAt: null,
      planCode: null,
    };
  }

  const latestKnownSubscription = activeSubscription ?? latestActivatedSubscription;

  if (!latestKnownSubscription?.activatedAt) {
    return {
      agencyFound: true,
      isActive: agency.isActive,
      expiredBySchedule: false,
      expiresAt: null,
      planCode: latestKnownSubscription?.plan ?? null,
    };
  }

  const expiresAt = getSubscriptionAccessEndsAt({
    activatedAt: latestKnownSubscription.activatedAt,
    billingCycleMonths: latestKnownSubscription.billingCycleMonths,
    commitmentMonths: latestKnownSubscription.commitmentMonths,
    canceledAt: latestKnownSubscription.canceledAt,
  });

  if (!activeSubscription) {
    return {
      agencyFound: true,
      isActive: agency.isActive,
      expiredBySchedule: expiresAt.getTime() <= now.getTime(),
      expiresAt,
      planCode: latestKnownSubscription.plan,
    };
  }

  if (!activeSubscription.activatedAt) {
    return {
      agencyFound: true,
      isActive: agency.isActive,
      expiredBySchedule: false,
      expiresAt: null,
      planCode: activeSubscription.plan,
    };
  }

  if (
    !hasSubscriptionAccessReachedEnd(
      {
        activatedAt: activeSubscription.activatedAt,
        billingCycleMonths: activeSubscription.billingCycleMonths,
        commitmentMonths: activeSubscription.commitmentMonths,
        canceledAt: activeSubscription.canceledAt,
      },
      now
    )
  ) {
    return {
      agencyFound: true,
      isActive: agency.isActive,
      expiredBySchedule: false,
      expiresAt,
      planCode: activeSubscription.plan,
    };
  }

  await cancelExpiredSubscriptions([activeSubscription], now);

  return {
    agencyFound: true,
    isActive: false,
    expiredBySchedule: true,
    expiresAt,
    planCode: activeSubscription.plan,
  };
}

export async function deactivateExpiredSubscriptions(
  now: Date = new Date()
): Promise<SubscriptionExpirationSweepResult> {
  const activeSubscriptions = await prisma.agencySubscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      activatedAt: { not: null },
    },
    orderBy: [
      { agencyId: "asc" },
      { activatedAt: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      agencyId: true,
      plan: true,
      activatedAt: true,
      billingCycleMonths: true,
      commitmentMonths: true,
      canceledAt: true,
    },
  });

  const latestActiveByAgency = new Map<string, SubscriptionAccessSnapshot>();

  for (const subscription of activeSubscriptions) {
    if (!latestActiveByAgency.has(subscription.agencyId)) {
      latestActiveByAgency.set(subscription.agencyId, subscription);
    }
  }

  const expiredSubscriptions = Array.from(latestActiveByAgency.values()).filter(
    (subscription) =>
      !!subscription.activatedAt &&
      hasSubscriptionAccessReachedEnd(
        {
          activatedAt: subscription.activatedAt,
          billingCycleMonths: subscription.billingCycleMonths,
          commitmentMonths: subscription.commitmentMonths,
          canceledAt: subscription.canceledAt,
        },
        now
      )
  );

  if (!expiredSubscriptions.length) {
    return {
      checkedActiveSubscriptions: latestActiveByAgency.size,
      expiredSubscriptions: 0,
    };
  }

  await cancelExpiredSubscriptions(expiredSubscriptions, now);

  return {
    checkedActiveSubscriptions: latestActiveByAgency.size,
    expiredSubscriptions: expiredSubscriptions.length,
  };
}

async function cancelExpiredSubscriptions(
  subscriptions: SubscriptionAccessSnapshot[],
  now: Date
) {
  const expiredSubscriptionIds = subscriptions.map((subscription) => subscription.id);
  const expiredAgencyIds = Array.from(
    new Set(subscriptions.map((subscription) => subscription.agencyId))
  );

  await prisma.$transaction(async (tx) => {
    await tx.agencySubscription.updateMany({
      where: {
        id: { in: expiredSubscriptionIds },
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        status: SubscriptionStatus.CANCELED,
        lastEventAt: now,
      },
    });

    await tx.agencySubscription.updateMany({
      where: {
        id: { in: expiredSubscriptionIds },
        canceledAt: null,
      },
      data: {
        canceledAt: now,
      },
    });

    await tx.agency.updateMany({
      where: {
        id: { in: expiredAgencyIds },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  });
}
