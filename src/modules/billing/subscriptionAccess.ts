import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { addMonths } from "./billing.utils";

export type AgencySubscriptionAccessState = {
  agencyFound: boolean;
  isActive: boolean;
  expiredBySchedule: boolean;
  expiresAt: Date | null;
};

type ActiveSubscriptionSnapshot = {
  id: string;
  agencyId: string;
  activatedAt: Date | null;
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

export function hasSubscriptionReachedEnd(
  activatedAt: Date,
  commitmentMonths: number,
  now: Date = new Date()
) {
  return getSubscriptionExpiresAt(activatedAt, commitmentMonths).getTime() <= now.getTime();
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
    };
  }

  const [agency, activeSubscription] = await Promise.all([
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
        activatedAt: true,
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
    };
  }

  if (!activeSubscription?.activatedAt) {
    return {
      agencyFound: true,
      isActive: agency.isActive,
      expiredBySchedule: false,
      expiresAt: null,
    };
  }

  const expiresAt = getSubscriptionExpiresAt(
    activeSubscription.activatedAt,
    activeSubscription.commitmentMonths
  );

  if (
    !hasSubscriptionReachedEnd(
      activeSubscription.activatedAt,
      activeSubscription.commitmentMonths,
      now
    )
  ) {
    return {
      agencyFound: true,
      isActive: agency.isActive,
      expiredBySchedule: false,
      expiresAt,
    };
  }

  await cancelExpiredSubscriptions([activeSubscription], now);

  return {
    agencyFound: true,
    isActive: false,
    expiredBySchedule: true,
    expiresAt,
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
      activatedAt: true,
      commitmentMonths: true,
      canceledAt: true,
    },
  });

  const latestActiveByAgency = new Map<string, ActiveSubscriptionSnapshot>();

  for (const subscription of activeSubscriptions) {
    if (!latestActiveByAgency.has(subscription.agencyId)) {
      latestActiveByAgency.set(subscription.agencyId, subscription);
    }
  }

  const expiredSubscriptions = Array.from(latestActiveByAgency.values()).filter(
    (subscription) =>
      !!subscription.activatedAt &&
      hasSubscriptionReachedEnd(
        subscription.activatedAt,
        subscription.commitmentMonths,
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
  subscriptions: ActiveSubscriptionSnapshot[],
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
        canceledAt: now,
        lastEventAt: now,
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
