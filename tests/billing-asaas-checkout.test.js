const test = require("node:test");
const assert = require("node:assert/strict");

const { AsaasClient } = require("../src/modules/billing/asaas.client");
const { getSubscriptionPlan } = require("../src/modules/billing/plans");

test("createRecurringCheckout retries without customerData when Asaas rejects the postal code", async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    ASAAS_API_URL: process.env.ASAAS_API_URL,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_CHECKOUT_BASE_URL: process.env.ASAAS_CHECKOUT_BASE_URL,
    FRONTEND_APP_URL: process.env.FRONTEND_APP_URL,
  };

  process.env.ASAAS_API_URL = "https://api-sandbox.asaas.com/v3";
  process.env.ASAAS_API_KEY = "test_key";
  process.env.ASAAS_CHECKOUT_BASE_URL = "https://sandbox.asaas.com/checkout/{id}";
  process.env.FRONTEND_APP_URL = "https://vouchercard.com.br";

  const requestBodies = [];

  global.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body ?? "{}")));

    if (requestBodies.length === 1) {
      return new Response(
        JSON.stringify({
          errors: [{ description: "O campo postalCode e invalido." }],
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        id: "chk_123",
        link: "https://sandbox.asaas.com/checkout/chk_123",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    const client = new AsaasClient();
    const plan = getSubscriptionPlan("MONTHLY");

    const checkout = await client.createRecurringCheckout({
      plan,
      sessionToken: "session_123",
      customerData: {
        name: "Agencia Teste",
        email: "teste@example.com",
        phone: "14999999999",
        cpfCnpj: "41811517862",
        postalCode: "17280003",
        address: "Rua Coronel Coimbra",
        addressNumber: "66",
        complement: "",
        province: "Centro",
        city: 3536704,
      },
    });

    assert.equal(requestBodies.length, 2);
    assert.equal(requestBodies[0].customerData.postalCode, "17280003");
    assert.equal("customerData" in requestBodies[1], false);
    assert.equal(checkout.id, "chk_123");
    assert.equal(checkout.url, "https://sandbox.asaas.com/checkout/chk_123");
  } finally {
    global.fetch = originalFetch;

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
