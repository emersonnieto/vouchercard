import { SubscriptionPlanDefinition } from "./plans";
import { addMinutes, formatDateOnly } from "./billing.utils";

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

function getRequiredEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback;
  if (!value) {
    throw new Error(`${name} nao configurada`);
  }
  return value;
}

export class AsaasClient {
  private readonly baseUrl = getRequiredEnv(
    "ASAAS_API_URL",
    "https://api-sandbox.asaas.com/v3"
  );

  private readonly apiKey = getRequiredEnv("ASAAS_API_KEY");

  private readonly checkoutBaseUrl = getRequiredEnv(
    "ASAAS_CHECKOUT_BASE_URL",
    "https://asaas.com/checkoutSession/show?id="
  );

  private readonly frontendAppUrl = getRequiredEnv(
    "FRONTEND_APP_URL",
    "http://localhost:5173"
  );

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
        nextDueDate: formatDateOnly(now),
      },
    };

    const checkout = await this.request<AsaasCheckoutResponse>("/checkouts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      ...checkout,
      url: `${this.checkoutBaseUrl}${checkout.id}`,
      expiresAt: addMinutes(now, payload.minutesToExpire),
    };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        access_token: this.apiKey,
        ...(init.headers ?? {}),
      },
    });

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
