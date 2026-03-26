import bcrypt from "bcrypt";
import { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AsaasApiError, AsaasClient } from "./asaas.client";
import {
  generatePublicToken,
  isValidCpfCnpj,
  mapAsaasEventToStatus,
  normalizeEmail,
  normalizePhone,
  resolveAsaasSubscriptionState,
  sanitizeDigits,
  slugifyAgencyName,
} from "./billing.utils";
import { resolveIbgeCityCode } from "./cityCodeLookup";
import { reconcileSignupSessionCheckout } from "./checkoutReconciliation";
import { getSubscriptionPlan, listSubscriptionPlans } from "./plans";
import { lookupBrazilianPostalCode } from "./postalCodeLookup";
import { verifyRenewalAccessToken } from "./renewal";
import {
  resolveSignupEmailPolicy,
  SIGNUP_EMAIL_IN_USE_MESSAGE,
} from "./signupEmailPolicy";
import {
  type BillingLegalAcceptanceKind,
  type SubmittedBillingLegalAcceptance,
  getCurrentBillingLegalDocuments,
  isBillingLegalAcceptanceValid,
} from "./legalDocuments";
import { getSubscriptionAccessEndsAt } from "./subscriptionAccess";

export type SignupPayload = {
  planCode?: string;
  agencyName?: string;
  contactName?: string;
  email?: string;
  password?: string;
  renewalToken?: string;
  phone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  website?: string;
  termsAccepted?: boolean;
  termsAcceptance?: SubmittedBillingLegalAcceptance;
};

export type SignupRequestMeta = {
  ipAddress?: string;
  userAgent?: string;
  acceptLanguage?: string;
  requestPath?: string;
  origin?: string;
  referer?: string;
};

export type RenewalPrefillResponse = {
  agencyName: string;
  contactName: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  website: string;
};

type SignupContext = {
  agencyId: string;
  subscriptionId: string;
  sessionToken: string;
  planCode: "MONTHLY" | "SEMIANNUAL" | "ANNUAL";
  acceptanceKind: "signup" | "renewal";
  acceptedLegalBundle: ReturnType<typeof getCurrentBillingLegalDocuments>;
};

type EventLookup = {
  id: string;
  agencyId: string;
  provider: string;
  plan: "MONTHLY" | "SEMIANNUAL" | "ANNUAL";
  status: SubscriptionStatus;
  billingCycleMonths: number;
  commitmentMonths: number;
  price: Prisma.Decimal;
  currency: string;
  providerCheckoutId: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  latestPaymentId: string | null;
  checkoutExpiresAt: Date | null;
  activatedAt: Date | null;
  canceledAt: Date | null;
};

type BillingDbClient = Prisma.TransactionClient | typeof prisma;

type SubscriptionSummaryRecord = {
  id: string;
  provider: string;
  plan: "MONTHLY" | "SEMIANNUAL" | "ANNUAL";
  status: SubscriptionStatus;
  billingCycleMonths: number;
  commitmentMonths: number;
  price: Prisma.Decimal;
  currency: string;
  activatedAt: Date | null;
  canceledAt: Date | null;
  providerSubscriptionId: string | null;
};

type CancelableSubscriptionRecord = SubscriptionSummaryRecord & {
  providerCheckoutId: string | null;
  providerCustomerId: string | null;
};

export type AgencySubscriptionSummary = {
  id: string;
  provider: string;
  planCode: "MONTHLY" | "SEMIANNUAL" | "ANNUAL";
  planName: string;
  status: SubscriptionStatus;
  billingCycleMonths: number;
  commitmentMonths: number;
  price: number;
  currency: string;
  activatedAt: Date | null;
  canceledAt: Date | null;
  accessEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canCancel: boolean;
};

export function getPublicPlans() {
  return listSubscriptionPlans();
}

export async function getAgencySubscriptionSummary(
  agencyId: string,
  db: BillingDbClient = prisma
) {
  const normalizedAgencyId = String(agencyId ?? "").trim();

  if (!normalizedAgencyId) {
    return null;
  }

  const subscription = await db.agencySubscription.findFirst({
    where: {
      agencyId: normalizedAgencyId,
      status: SubscriptionStatus.ACTIVE,
    },
    orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
    select: subscriptionSummarySelect,
  });

  if (!subscription) {
    return null;
  }

  return mapAgencySubscriptionSummary(subscription);
}

export async function cancelAgencySubscription(
  agencyId: string,
  db: BillingDbClient = prisma,
  now: Date = new Date()
) {
  const normalizedAgencyId = String(agencyId ?? "").trim();

  if (!normalizedAgencyId) {
    throw new BillingValidationError("Agencia invalida.");
  }

  const subscription = await db.agencySubscription.findFirst({
    where: {
      agencyId: normalizedAgencyId,
      status: SubscriptionStatus.ACTIVE,
      activatedAt: { not: null },
    },
    orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
    select: cancelableSubscriptionSelect,
  });

  if (!subscription) {
    throw new BillingValidationError("Nenhuma assinatura ativa foi encontrada.");
  }

  if (subscription.canceledAt) {
    return mapAgencySubscriptionSummary(subscription);
  }

  const remoteSubscription = await resolveRemoteAsaasSubscription(subscription);
  const providerSubscriptionId = remoteSubscription?.id?.trim();

  if (!providerSubscriptionId) {
    throw new BillingValidationError(
      "Nao foi possivel localizar a cobranca recorrente desta assinatura. Contate o suporte."
    );
  }

  try {
    await getAsaasClient().cancelSubscription(providerSubscriptionId);
  } catch (error) {
    if (!(error instanceof AsaasApiError && error.statusCode === 404)) {
      throw new BillingIntegrationError(
        error instanceof Error
          ? error.message
          : "Falha ao cancelar a assinatura no Asaas."
      );
    }
  }

  const updatedSubscription = await db.agencySubscription.update({
    where: { id: subscription.id },
    data: {
      providerCustomerId:
        remoteSubscription?.customer?.trim() || subscription.providerCustomerId || undefined,
      providerSubscriptionId,
      canceledAt: now,
      lastEventAt: now,
    },
    select: subscriptionSummarySelect,
  });

  return mapAgencySubscriptionSummary(updatedSubscription);
}

export async function getRenewalPrefill(token: string) {
  const payload = (() => {
    try {
      return verifyRenewalAccessToken(token);
    } catch {
      throw new BillingValidationError("Token de renovacao invalido.");
    }
  })();

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      agencyId: true,
      agency: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          contactName: true,
          document: true,
          postalCode: true,
          street: true,
          addressNumber: true,
          complement: true,
          neighborhood: true,
          city: true,
          state: true,
          website: true,
        },
      },
    },
  });

  if (
    !user?.agency ||
    user.agencyId !== payload.agencyId ||
    normalizeEmail(user.email) !== normalizeEmail(payload.email)
  ) {
    throw new BillingValidationError("Token de renovacao invalido.");
  }

  return {
    agencyName: user.agency.name,
    contactName: user.agency.contactName || user.name,
    email: normalizeEmail(user.email),
    phone: user.agency.phone || "",
    cpfCnpj: user.agency.document || "",
    postalCode: user.agency.postalCode || "",
    address: user.agency.street || "",
    addressNumber: user.agency.addressNumber || "",
    complement: user.agency.complement || "",
    neighborhood: user.agency.neighborhood || "",
    city: user.agency.city || "",
    state: user.agency.state || "",
    website: user.agency.website || "",
  } satisfies RenewalPrefillResponse;
}

export async function createAgencySignup(
  payload: SignupPayload,
  requestMeta: SignupRequestMeta = {}
) {
  const renewalAccess = resolveSignupRenewalAccess(payload.renewalToken);
  const acceptanceKind: BillingLegalAcceptanceKind = renewalAccess
    ? "renewal"
    : "signup";
  const valid = validateSignupPayload(payload, {
    requirePassword: !renewalAccess,
    acceptanceKind,
  });
  const normalizedAddress = await normalizeSignupAddress(valid);
  const passwordHash = renewalAccess
    ? null
    : await bcrypt.hash(valid.password, 10);

  let context: SignupContext;

  try {
    context = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: valid.email },
        select: {
          id: true,
          role: true,
          agencyId: true,
          agency: {
            select: {
              id: true,
              isActive: true,
              asaasCustomerId: true,
            },
          },
        },
      });

      const emailPolicy = resolveSignupEmailPolicy(existingUser);
      if (
        emailPolicy.status === "reserved" ||
        emailPolicy.status === "in_use"
      ) {
        throw new BillingValidationError(emailPolicy.message);
      }

      if (renewalAccess) {
        if (
          !existingUser?.agencyId ||
          existingUser.id !== renewalAccess.userId ||
          existingUser.agencyId !== renewalAccess.agencyId ||
          valid.email !== normalizeEmail(renewalAccess.email)
        ) {
          throw new BillingValidationError("Token de renovacao invalido.");
        }
      }

      let agencyId = existingUser?.agency?.id ?? "";
      const sessionToken = generatePublicToken();
      if (existingUser?.agencyId) {
        await tx.agency.update({
          where: { id: existingUser.agencyId },
          data: {
            name: valid.agencyName,
            phone: valid.phone,
            email: valid.email,
            contactName: valid.contactName,
            document: valid.cpfCnpj,
            postalCode: normalizedAddress.postalCode,
            street: normalizedAddress.address,
            addressNumber: valid.addressNumber,
            complement: valid.complement,
            neighborhood: normalizedAddress.neighborhood,
            city: normalizedAddress.city,
            state: normalizedAddress.state,
            website: valid.website,
            isActive: false,
          },
        });

        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: valid.contactName,
            role: "ADMIN",
            ...(passwordHash ? { passwordHash } : {}),
          },
        });
      } else {
        if (renewalAccess || !passwordHash) {
          throw new BillingValidationError("Token de renovacao invalido.");
        }

        const slug = await generateUniqueAgencySlug(tx, valid.agencyName);
        const agency = await tx.agency.create({
          data: {
            name: valid.agencyName,
            slug,
            phone: valid.phone,
            email: valid.email,
            contactName: valid.contactName,
            document: valid.cpfCnpj,
            postalCode: normalizedAddress.postalCode,
            street: normalizedAddress.address,
            addressNumber: valid.addressNumber,
            complement: valid.complement,
            neighborhood: normalizedAddress.neighborhood,
            city: normalizedAddress.city,
            state: normalizedAddress.state,
            website: valid.website,
            isActive: false,
          },
          select: {
            id: true,
          },
        });

        agencyId = agency.id;

        await tx.user.create({
          data: {
            agencyId: agency.id,
            name: valid.contactName,
            email: valid.email,
            passwordHash,
            role: "ADMIN",
          },
        });
      }

      await tx.agencySubscription.updateMany({
        where: {
          agencyId,
          status: {
            in: [
              SubscriptionStatus.PENDING,
              SubscriptionStatus.CHECKOUT_CREATED,
              SubscriptionStatus.CHECKOUT_EXPIRED,
              SubscriptionStatus.PAST_DUE,
            ],
          },
        },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
        },
      });

      const subscription = await tx.agencySubscription.create({
        data: {
          agencyId,
          publicToken: sessionToken,
          plan: valid.plan.code,
          status: SubscriptionStatus.PENDING,
          billingCycleMonths: valid.plan.billingCycleMonths,
          commitmentMonths: valid.plan.commitmentMonths,
          price: new Prisma.Decimal(valid.plan.monthlyPrice),
          currency: "BRL",
        },
        select: {
          id: true,
        },
      });

      await tx.billingLegalAcceptance.create({
        data: {
          kind: acceptanceKind.toUpperCase(),
          email: valid.email,
          agencyId,
          subscriptionId: subscription.id,
          publicToken: sessionToken,
          statementText: valid.acceptedLegalBundle.statement,
          statementHash: valid.acceptedLegalBundle.statementHash,
          termsTitle: valid.acceptedLegalBundle.terms.title,
          termsVersion: valid.acceptedLegalBundle.terms.version,
          termsHash: valid.acceptedLegalBundle.terms.hash,
          termsText: valid.acceptedLegalBundle.terms.body,
          privacyTitle: valid.acceptedLegalBundle.privacyPolicy.title,
          privacyVersion: valid.acceptedLegalBundle.privacyPolicy.version,
          privacyHash: valid.acceptedLegalBundle.privacyPolicy.hash,
          privacyText: valid.acceptedLegalBundle.privacyPolicy.body,
          bundleHash: valid.acceptedLegalBundle.bundleHash,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          acceptLanguage: requestMeta.acceptLanguage,
          requestPath: requestMeta.requestPath,
          origin: requestMeta.origin,
          referer: requestMeta.referer,
        },
      });

      return {
        agencyId,
        subscriptionId: subscription.id,
        sessionToken,
        planCode: valid.plan.code,
        acceptanceKind,
        acceptedLegalBundle: valid.acceptedLegalBundle,
      } satisfies SignupContext;
    });
  } catch (error) {
    if (isUserEmailUniqueConstraintError(error)) {
      throw new BillingValidationError(SIGNUP_EMAIL_IN_USE_MESSAGE);
    }

    throw error;
  }

  const plan = getSubscriptionPlan(context.planCode);
  if (!plan) {
    throw new BillingValidationError("Plano invalido.");
  }

  try {
    const cityCode = await resolveIbgeCityCode({
      city: normalizedAddress.city,
      state: normalizedAddress.state,
    });

    if (!cityCode) {
      throw new BillingValidationError(
        "Nao foi possivel identificar a cidade da agencia. Revise cidade e UF."
      );
    }

    const checkout = await getAsaasClient().createRecurringCheckout({
      plan,
      sessionToken: context.sessionToken,
      customerData: {
        name: valid.contactName,
        email: valid.email,
        phone: valid.phone,
        cpfCnpj: valid.cpfCnpj,
        postalCode: normalizedAddress.postalCode,
        address: normalizedAddress.address,
        addressNumber: valid.addressNumber,
        complement: valid.complement,
        province: normalizedAddress.neighborhood,
        city: cityCode,
      },
    });

    await prisma.agencySubscription.update({
      where: { id: context.subscriptionId },
      data: {
        providerCheckoutId: checkout.id,
        checkoutUrl: checkout.url,
        checkoutExpiresAt: checkout.expiresAt,
        status: SubscriptionStatus.CHECKOUT_CREATED,
      },
    });

    return {
      sessionToken: context.sessionToken,
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
      loginEmail: valid.email,
      agencyId: context.agencyId,
      expiresAt: checkout.expiresAt,
    };
  } catch (error) {
    if (error instanceof BillingValidationError) {
      throw error;
    }

    if (
      error instanceof Error &&
      normalizeErrorText(error.message).includes("campo postalcode e invalido")
    ) {
      throw new BillingValidationError(
        "Nao foi possivel validar o CEP informado. Revise o CEP, a cidade e a UF."
      );
    }

    throw new BillingIntegrationError(
      error instanceof Error ? error.message : "Falha ao criar checkout no Asaas."
    );
  }
}

export async function getSignupSession(publicToken: string) {
  const normalizedToken = String(publicToken ?? "").trim();

  if (!normalizedToken) {
    return null;
  }

  let subscription = await prisma.agencySubscription.findUnique({
    where: { publicToken: normalizedToken },
    select: {
      publicToken: true,
      plan: true,
      status: true,
      checkoutUrl: true,
      providerCheckoutId: true,
      checkoutExpiresAt: true,
      activatedAt: true,
      createdAt: true,
      agency: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
    },
  });

  if (!subscription) {
    return null;
  }

  if (subscription.status !== SubscriptionStatus.ACTIVE || !subscription.agency.isActive) {
    const reconciled = await reconcileSignupSessionCheckout(normalizedToken);

    if (reconciled) {
      subscription = await prisma.agencySubscription.findUnique({
        where: { publicToken: normalizedToken },
        select: {
          publicToken: true,
          plan: true,
          status: true,
          checkoutUrl: true,
          providerCheckoutId: true,
          checkoutExpiresAt: true,
          activatedAt: true,
          createdAt: true,
          agency: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      });
    }
  }

  if (!subscription) {
    return null;
  }

  const publicPlan = listSubscriptionPlans().find(
    (plan) => plan.code === subscription.plan
  );

  return {
    sessionToken: subscription.publicToken,
    status: subscription.status,
    activatedAt: subscription.activatedAt,
    checkoutExpiresAt: subscription.checkoutExpiresAt,
    createdAt: subscription.createdAt,
    checkoutUrl: normalizeCheckoutUrl(
      subscription.checkoutUrl,
      subscription.providerCheckoutId
    ),
    agency: subscription.agency,
    plan: publicPlan
      ? {
          code: publicPlan.code,
          name: publicPlan.name,
          monthlyPrice: publicPlan.monthlyPrice,
          monthlyPriceFormatted: publicPlan.monthlyPriceFormatted,
        }
      : null,
  };
}

function normalizeCheckoutUrl(
  checkoutUrl: string | null,
  providerCheckoutId: string | null
) {
  const trimmedUrl = checkoutUrl?.trim() || "";

  if (trimmedUrl.includes("/checkoutSession/show?id=")) {
    return trimmedUrl.replace(
      "/checkoutSession/show?id=",
      "/checkoutSession/show/"
    );
  }

  if (trimmedUrl) {
    return trimmedUrl;
  }

  if (!providerCheckoutId) {
    return null;
  }

  const baseUrl =
    process.env.ASAAS_CHECKOUT_BASE_URL?.trim() ||
    "https://sandbox.asaas.com/checkoutSession/show/";

  if (baseUrl.includes("{id}")) {
    return baseUrl.replace("{id}", providerCheckoutId);
  }

  if (baseUrl.includes("?id=")) {
    return `${baseUrl}${providerCheckoutId}`;
  }

  return `${baseUrl.replace(/\/+$/, "")}/${providerCheckoutId}`;
}

export async function handleAsaasWebhookEvent(
  payload: Record<string, unknown>,
  authToken: string | undefined
) {
  const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (configuredToken && configuredToken !== authToken?.trim()) {
    throw new BillingUnauthorizedError("Webhook do Asaas nao autorizado.");
  }

  const eventId = String(payload.id ?? "").trim();
  const eventName = String(payload.event ?? "").trim();

  if (!eventId || !eventName) {
    throw new BillingValidationError("Webhook invalido.");
  }

  try {
    await prisma.billingWebhookEvent.create({
      data: {
        id: eventId,
        provider: "ASAAS",
        event: eventName,
        payload: JSON.parse(JSON.stringify(payload)),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { duplicate: true };
    }

    throw error;
  }

  const checkout = asRecord(payload.checkout);
  const payment = asRecord(payload.payment);
  const checkoutId = readString(checkout?.id);
  const customerId = readString(payment?.customer) ?? readString(checkout?.customer);
  const providerSubscriptionId = readString(payment?.subscription);
  const paymentId = readString(payment?.id);
  const statusDecision = mapAsaasEventToStatus(eventName);

  if (!statusDecision) {
    return { handled: false };
  }

  const agencySubscription = await findSubscriptionForEvent({
    checkoutId,
    customerId,
    subscriptionId: providerSubscriptionId,
  });

  if (!agencySubscription) {
    return { handled: false };
  }

  const checkoutMinutesToExpire = Number(checkout?.minutesToExpire ?? 0);
  const checkoutExpiresAt =
    eventName === "CHECKOUT_CREATED" && Number.isFinite(checkoutMinutesToExpire)
      ? new Date(Date.now() + checkoutMinutesToExpire * 60_000)
      : undefined;
  const recoveredRemoteSubscription = await recoverRemoteSubscriptionForEvent({
    agencySubscription,
    checkoutId,
    providerSubscriptionId,
  });
  const resolvedProviderCustomerId =
    customerId ??
    recoveredRemoteSubscription?.customer?.trim() ??
    agencySubscription.providerCustomerId;
  const resolvedProviderSubscriptionId =
    providerSubscriptionId ??
    recoveredRemoteSubscription?.id?.trim() ??
    agencySubscription.providerSubscriptionId;
  const transition = resolveAsaasSubscriptionState({
    currentStatus: agencySubscription.status,
    activatedAt: agencySubscription.activatedAt,
    canceledAt: agencySubscription.canceledAt,
    eventName,
    incomingStatus: statusDecision.status,
    activateAgency: statusDecision.activateAgency,
  });

  await prisma.$transaction(async (tx) => {
    await tx.agencySubscription.update({
      where: { id: agencySubscription.id },
      data: {
        providerCheckoutId: checkoutId ?? agencySubscription.providerCheckoutId,
        providerCustomerId: resolvedProviderCustomerId,
        providerSubscriptionId: resolvedProviderSubscriptionId,
        latestPaymentId: paymentId ?? agencySubscription.latestPaymentId,
        status: transition.nextStatus,
        checkoutExpiresAt:
          transition.shouldPreserveActiveAccess
            ? agencySubscription.checkoutExpiresAt ?? undefined
            : checkoutExpiresAt ?? agencySubscription.checkoutExpiresAt ?? undefined,
        activatedAt:
          transition.nextStatus === SubscriptionStatus.ACTIVE
            ? agencySubscription.activatedAt ?? new Date()
            : agencySubscription.activatedAt,
        canceledAt: transition.nextCanceledAt,
        lastEventAt: new Date(),
      },
    });

    await tx.agency.update({
      where: { id: agencySubscription.agencyId },
      data: {
        asaasCustomerId: resolvedProviderCustomerId ?? undefined,
        isActive: transition.nextAgencyActive,
      },
    });
  });

  return {
    handled: true,
    subscriptionId: agencySubscription.id,
  };
}

async function generateUniqueAgencySlug(
  tx: Prisma.TransactionClient,
  agencyName: string
) {
  const baseSlug = slugifyAgencyName(agencyName) || "agencia";

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existing = await tx.agency.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

function validateSignupPayload(
  payload: SignupPayload,
  options: {
    requirePassword?: boolean;
    acceptanceKind?: BillingLegalAcceptanceKind;
  } = {}
) {
  const plan = getSubscriptionPlan(payload.planCode);
  if (!plan) {
    throw new BillingValidationError("Plano invalido.");
  }

  const agencyName = String(payload.agencyName ?? "").trim();
  const contactName = String(payload.contactName ?? "").trim();
  const email = normalizeEmail(String(payload.email ?? ""));
  const password = String(payload.password ?? "");
  const phone = normalizePhone(String(payload.phone ?? ""));
  const cpfCnpj = sanitizeDigits(String(payload.cpfCnpj ?? ""));
  const postalCode = sanitizeDigits(String(payload.postalCode ?? ""));
  const address = String(payload.address ?? "").trim();
  const addressNumber = String(payload.addressNumber ?? "").trim();
  const complement = String(payload.complement ?? "").trim();
  const neighborhood = String(payload.neighborhood ?? "").trim();
  const city = String(payload.city ?? "").trim();
  const state = String(payload.state ?? "").trim().toUpperCase();
  const website = String(payload.website ?? "").trim();
  const termsAccepted = payload.termsAccepted === true;
  const requirePassword = options.requirePassword !== false;
  const acceptanceKind = options.acceptanceKind ?? "signup";

  if (agencyName.length < 2) {
    throw new BillingValidationError("Informe o nome da agencia.");
  }

  if (contactName.length < 2) {
    throw new BillingValidationError("Informe o nome do responsavel.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BillingValidationError("Informe um email valido.");
  }

  if (requirePassword && password.length < 8) {
    throw new BillingValidationError(
      "A senha precisa ter no minimo 8 caracteres."
    );
  }

  if (phone.length < 10) {
    throw new BillingValidationError("Informe um telefone valido.");
  }

  if (!(cpfCnpj.length === 11 || cpfCnpj.length === 14)) {
    throw new BillingValidationError("Informe um CPF ou CNPJ valido.");
  }

  if (!isValidCpfCnpj(cpfCnpj)) {
    throw new BillingValidationError("Informe um CPF ou CNPJ valido.");
  }

  if (postalCode.length !== 8) {
    throw new BillingValidationError("Informe um CEP valido.");
  }

  if (!address) {
    throw new BillingValidationError("Informe o endereco da agencia.");
  }

  if (!addressNumber) {
    throw new BillingValidationError("Informe o numero do endereco.");
  }

  if (!neighborhood) {
    throw new BillingValidationError("Informe o bairro.");
  }

  if (!city) {
    throw new BillingValidationError("Informe a cidade.");
  }

  if (state.length !== 2) {
    throw new BillingValidationError("Informe a UF com 2 caracteres.");
  }

  if (!termsAccepted) {
    throw new BillingValidationError(
      "Voce precisa aceitar os termos para continuar."
    );
  }

  if (!isBillingLegalAcceptanceValid(acceptanceKind, payload.termsAcceptance)) {
    throw new BillingValidationError(
      "Os termos foram atualizados ou o aceite nao foi confirmado corretamente. Revise o documento e aceite novamente."
    );
  }

  return {
    plan,
    agencyName,
    contactName,
    email,
    password,
    phone,
    cpfCnpj,
    postalCode,
    address,
    addressNumber,
    complement,
    neighborhood,
    city,
    state,
    website,
    acceptedLegalBundle: getCurrentBillingLegalDocuments(acceptanceKind),
  };
}

function resolveSignupRenewalAccess(renewalToken: string | undefined) {
  const trimmedToken = String(renewalToken ?? "").trim();

  if (!trimmedToken) {
    return null;
  }

  try {
    return verifyRenewalAccessToken(trimmedToken);
  } catch {
    throw new BillingValidationError("Token de renovacao invalido.");
  }
}

async function normalizeSignupAddress(valid: ReturnType<typeof validateSignupPayload>) {
  const postalLookup = await lookupBrazilianPostalCode(valid.postalCode);

  if (postalLookup.status === "not_found") {
    throw new BillingValidationError("Informe um CEP valido.");
  }

  if (postalLookup.status !== "ok") {
    return {
      postalCode: valid.postalCode,
      address: valid.address,
      neighborhood: valid.neighborhood,
      city: valid.city,
      state: valid.state,
    };
  }

  return {
    postalCode: postalLookup.data.postalCode || valid.postalCode,
    address: valid.address || postalLookup.data.street || "",
    neighborhood: postalLookup.data.neighborhood || valid.neighborhood,
    city: postalLookup.data.city || valid.city,
    state: (postalLookup.data.state || valid.state).toUpperCase(),
  };
}

function normalizeErrorText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isUserEmailUniqueConstraintError(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;
  const entries = Array.isArray(target)
    ? target
    : target === undefined || target === null
    ? []
    : [target];

  return entries.some((entry) => String(entry).toLowerCase().includes("email"));
}

async function resolveRemoteAsaasSubscription(
  subscription: CancelableSubscriptionRecord
) {
  const providerSubscriptionId = subscription.providerSubscriptionId?.trim();

  if (providerSubscriptionId) {
    return {
      id: providerSubscriptionId,
      customer: subscription.providerCustomerId?.trim() || null,
    };
  }

  const providerCheckoutId = subscription.providerCheckoutId?.trim();

  if (!providerCheckoutId) {
    return null;
  }

  return getAsaasClient().findActiveSubscriptionByCheckoutSession(providerCheckoutId);
}

async function recoverRemoteSubscriptionForEvent(input: {
  agencySubscription: EventLookup;
  checkoutId: string | null;
  providerSubscriptionId: string | null;
}) {
  if (input.providerSubscriptionId?.trim()) {
    return null;
  }

  const providerCheckoutId =
    input.checkoutId?.trim() || input.agencySubscription.providerCheckoutId?.trim();

  if (!providerCheckoutId) {
    return null;
  }

  try {
    return await getAsaasClient().findActiveSubscriptionByCheckoutSession(
      providerCheckoutId
    );
  } catch (error) {
    console.error(
      "[ASAAS] Falha ao reconciliar assinatura pelo checkoutSession:",
      error
    );
    return null;
  }
}

async function findSubscriptionForEvent(filters: {
  checkoutId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<EventLookup | null> {
  if (filters.subscriptionId) {
    const bySubscriptionId = await prisma.agencySubscription.findFirst({
      where: { providerSubscriptionId: filters.subscriptionId },
      orderBy: { createdAt: "desc" },
      select: lookupSelect,
    });

    if (bySubscriptionId) return bySubscriptionId;
  }

  if (filters.checkoutId) {
    const byCheckoutId = await prisma.agencySubscription.findFirst({
      where: { providerCheckoutId: filters.checkoutId },
      orderBy: { createdAt: "desc" },
      select: lookupSelect,
    });

    if (byCheckoutId) return byCheckoutId;
  }

  if (filters.customerId) {
    return prisma.agencySubscription.findFirst({
      where: { providerCustomerId: filters.customerId },
      orderBy: { createdAt: "desc" },
      select: lookupSelect,
    });
  }

  return null;
}

const lookupSelect = {
  id: true,
  agencyId: true,
  provider: true,
  plan: true,
  status: true,
  billingCycleMonths: true,
  commitmentMonths: true,
  price: true,
  currency: true,
  providerCheckoutId: true,
  providerCustomerId: true,
  providerSubscriptionId: true,
  latestPaymentId: true,
  checkoutExpiresAt: true,
  activatedAt: true,
  canceledAt: true,
} as const;

const subscriptionSummarySelect = {
  id: true,
  provider: true,
  plan: true,
  status: true,
  billingCycleMonths: true,
  commitmentMonths: true,
  price: true,
  currency: true,
  activatedAt: true,
  canceledAt: true,
  providerSubscriptionId: true,
} as const;

const cancelableSubscriptionSelect = {
  ...subscriptionSummarySelect,
  providerCheckoutId: true,
  providerCustomerId: true,
} as const;

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapAgencySubscriptionSummary(
  subscription: SubscriptionSummaryRecord
): AgencySubscriptionSummary {
  const plan = getSubscriptionPlan(subscription.plan);
  const accessEndsAt = subscription.activatedAt
    ? getSubscriptionAccessEndsAt({
        activatedAt: subscription.activatedAt,
        billingCycleMonths: subscription.billingCycleMonths,
        commitmentMonths: subscription.commitmentMonths,
        canceledAt: subscription.canceledAt,
      })
    : null;

  return {
    id: subscription.id,
    provider: subscription.provider,
    planCode: subscription.plan,
    planName: plan?.name ?? subscription.plan,
    status: subscription.status,
    billingCycleMonths: subscription.billingCycleMonths,
    commitmentMonths: subscription.commitmentMonths,
    price: Number(subscription.price),
    currency: subscription.currency,
    activatedAt: subscription.activatedAt,
    canceledAt: subscription.canceledAt,
    accessEndsAt,
    cancelAtPeriodEnd: !!subscription.canceledAt,
    canCancel:
      subscription.status === SubscriptionStatus.ACTIVE && !subscription.canceledAt,
  };
}

export class BillingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingValidationError";
  }
}

export class BillingIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingIntegrationError";
  }
}

export class BillingUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingUnauthorizedError";
  }
}

function getAsaasClient() {
  return new AsaasClient();
}
