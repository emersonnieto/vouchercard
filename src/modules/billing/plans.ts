export type SubscriptionPlanCode = "MONTHLY" | "SEMIANNUAL" | "ANNUAL";

export type SubscriptionPlanDefinition = {
  code: SubscriptionPlanCode;
  name: string;
  headline: string;
  description: string;
  monthlyPrice: number;
  commitmentMonths: number;
  billingCycleMonths: number;
  asaasCycle: "MONTHLY";
};

const plans: SubscriptionPlanDefinition[] = [
  {
    code: "MONTHLY",
    name: "Mensal",
    headline: "Comece rapido",
    description:
      "Plano flexivel para agencias que querem iniciar a operacao no VoucherCard sem fidelidade.",
    monthlyPrice: 199.9,
    commitmentMonths: 1,
    billingCycleMonths: 1,
    asaasCycle: "MONTHLY",
  },
  {
    code: "SEMIANNUAL",
    name: "Semestral",
    headline: "Escala com desconto",
    description:
      "Valor promocional mensal para agencias em crescimento com foco em previsibilidade.",
    monthlyPrice: 189.9,
    commitmentMonths: 6,
    billingCycleMonths: 1,
    asaasCycle: "MONTHLY",
  },
  {
    code: "ANNUAL",
    name: "Anual",
    headline: "Melhor custo mensal",
    description:
      "Ideal para donos de agencia que querem vender com mais autoridade e escalar com o melhor custo mensal.",
    monthlyPrice: 179.9,
    commitmentMonths: 12,
    billingCycleMonths: 1,
    asaasCycle: "MONTHLY",
  },
];

const plansByCode = new Map(plans.map((plan) => [plan.code, plan]));

export function listSubscriptionPlans() {
  return plans.map((plan) => ({
    ...plan,
    monthlyPriceFormatted: formatBrl(plan.monthlyPrice),
  }));
}

export function getSubscriptionPlan(code: string | undefined | null) {
  if (!code) return null;
  return plansByCode.get(code.toUpperCase() as SubscriptionPlanCode) ?? null;
}

export function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
