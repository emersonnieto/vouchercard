import { SubscriptionPlanDefinition } from "./plans";
import {
  addMinutes,
  formatDateOnly,
} from "./billing.utils";
import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
} from "../../lib/fetchWithTimeout";

const ASAAS_TIMEOUT_MS = 15_000;

type AsaasCustomerPayload = {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: number;
};

type AsaasCheckoutPayload = {
  billingTypes: ["CREDIT_CARD"];
  chargeTypes: ["RECURRENT"];
  minutesToExpire: number;
  callback: {
    successUrl: string;
    cancelUrl: string;
    expiredUrl: string;
    autoRedirect: boolean;
  };
  items: Array<{
    name: string;
    description: string;
    quantity: number;
    value: number;
  }>;
  customerData?: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone: string;
    city: number;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
  };
  subscription: {
    cycle: "MONTHLY";
    nextDueDate: string;
  };
};

type AsaasCheckoutResponse = {
  id: string;
  link?: string;
  status?: string;
};

type AsaasListResponse<T> = {
  object: "list";
  hasMore?: boolean;
  totalCount?: number;
  limit?: number;
  offset?: number;
  data?: T[];
};

export type AsaasSubscriptionRecord = {
  id: string;
  customer?: string | null;
  status?: string | null;
  checkoutSession?: string | null;
};

export type AsaasPaymentRecord = {
  id: string;
  status?: string | null;
  dueDate?: string | null;
  dateCreated?: string | null;
};

type AsaasErrorPayload = {
  errors?: Array<{ code?: string; description?: string }>;
};

export class AsaasApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "AsaasApiError";
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} nao configurada`);
  }
  return value;
}

export class AsaasClient {
  private readonly baseUrl = getRequiredEnv("ASAAS_API_URL");

  private readonly apiKey = getRequiredEnv("ASAAS_API_KEY");

  private readonly checkoutBaseUrl = getRequiredEnv("ASAAS_CHECKOUT_BASE_URL");

  private readonly frontendAppUrl = getRequiredEnv("FRONTEND_APP_URL");

  async createRecurringCheckout(input: {
    plan: SubscriptionPlanDefinition;
    sessionToken: string;
    customerData: AsaasCustomerPayload;
  }) {
    const now = new Date();
    const normalizedPhone = normalizeAsaasPhone(input.customerData.phone);

    if (!normalizedPhone) {
      throw new AsaasApiError("Telefone invalido para o checkout.", 400);
    }

    if (!input.customerData.city) {
      throw new AsaasApiError("Codigo IBGE da cidade nao informado.", 400);
    }

    const payload: AsaasCheckoutPayload = {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      callback: {
        successUrl: `${this.frontendAppUrl}/assinatura/sucesso?session=${input.sessionToken}`,
        cancelUrl: `${this.frontendAppUrl}/assinatura/cancelado?session=${input.sessionToken}`,
        expiredUrl: `${this.frontendAppUrl}/assinatura/expirado?session=${input.sessionToken}`,
        autoRedirect: true,
      },
      items: [
        {
          name: `VoucherCard ${input.plan.name}`,
          description: `Assinatura ${input.plan.name} do VoucherCard`,
          quantity: 1,
          value: input.plan.monthlyPrice,
        },
      ],
      customerData: {
        name: input.customerData.name,
        email: input.customerData.email,
        cpfCnpj: input.customerData.cpfCnpj || "",
        phone: normalizedPhone,
        city: input.customerData.city,
        postalCode: input.customerData.postalCode,
        address: input.customerData.address,
        addressNumber: input.customerData.addressNumber,
        complement: input.customerData.complement,
        province: input.customerData.province,
      },
      subscription: {
        cycle: input.plan.asaasCycle,
        // The first charge needs to be due today so Asaas can capture it on signup.
        nextDueDate: formatDateOnly(now),
      },
    };

    const checkout = await this.request<AsaasCheckoutResponse>("/checkouts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      ...checkout,
      url: resolveCheckoutUrl(checkout, this.checkoutBaseUrl),
      expiresAt: addMinutes(now, payload.minutesToExpire),
    };
  }

  async cancelSubscription(subscriptionId: string) {
    const normalizedSubscriptionId = String(subscriptionId ?? "").trim();

    if (!normalizedSubscriptionId) {
      throw new AsaasApiError("Assinatura do Asaas nao informada.", 400);
    }

    await this.request(`/subscriptions/${normalizedSubscriptionId}`, {
      method: "DELETE",
    });
  }

  async findActiveSubscriptionByCheckoutSession(checkoutSessionId: string) {
    const normalizedCheckoutSessionId = String(checkoutSessionId ?? "").trim();

    if (!normalizedCheckoutSessionId) {
      throw new AsaasApiError("Checkout do Asaas nao informado.", 400);
    }

    const pageSize = 100;

    for (let offset = 0; offset < 2_000; offset += pageSize) {
      const search = new URLSearchParams({
        status: "ACTIVE",
        limit: String(pageSize),
        offset: String(offset),
      });

      const response = await this.request<AsaasListResponse<AsaasSubscriptionRecord>>(
        `/subscriptions?${search.toString()}`,
        { method: "GET" }
      );

      const items = Array.isArray(response.data) ? response.data : [];
      const match = items.find(
        (item) => item.checkoutSession?.trim() === normalizedCheckoutSessionId
      );

      if (match) {
        return match;
      }

      if (!response.hasMore || !items.length) {
        break;
      }
    }

    return null;
  }

  async listSubscriptionPayments(subscriptionId: string) {
    const normalizedSubscriptionId = String(subscriptionId ?? "").trim();

    if (!normalizedSubscriptionId) {
      throw new AsaasApiError("Assinatura do Asaas nao informada.", 400);
    }

    const response = await this.request<AsaasListResponse<AsaasPaymentRecord>>(
      `/subscriptions/${normalizedSubscriptionId}/payments?limit=20&offset=0`,
      { method: "GET" }
    );

    return Array.isArray(response.data) ? response.data : [];
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetchWithTimeout(
        `${this.baseUrl}${path}`,
        {
          ...init,
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            access_token: this.apiKey,
            ...(init.headers ?? {}),
          },
        },
        { serviceName: "Asaas", timeoutMs: ASAAS_TIMEOUT_MS }
      );
    } catch (error) {
      if (error instanceof ExternalRequestTimeoutError) {
        throw new AsaasApiError(error.message, 504);
      }

      throw error;
    }

    const raw = await response.text();
    const parsed = raw ? tryParseJson(raw) : null;

    if (!response.ok) {
      const errorPayload = parsed as AsaasErrorPayload | null;
      const description =
        errorPayload?.errors
          ?.map((item) => item.description)
          .filter(Boolean)
          .join("; ") || `Erro na API do Asaas (${response.status})`;
      throw new AsaasApiError(description, response.status, parsed);
    }

    return (parsed ?? {}) as T;
  }
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeAsaasPhone(value: string | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");

  if (digits.length === 10 || digits.length === 11) {
    return digits;
  }

  return null;
}

function resolveCheckoutUrl(
  checkout: AsaasCheckoutResponse,
  fallbackBaseUrl: string
) {
  const link = checkout.link?.trim();
  if (link) {
    return link;
  }

  if (fallbackBaseUrl.includes("{id}")) {
    return fallbackBaseUrl.replace("{id}", checkout.id);
  }

  if (fallbackBaseUrl.includes("?id=")) {
    return `${fallbackBaseUrl}${checkout.id}`;
  }

  return `${fallbackBaseUrl.replace(/\/+$/, "")}/${checkout.id}`;
}
