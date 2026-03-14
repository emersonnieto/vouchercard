const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeBrazilianCityName,
} = require("../src/modules/billing/cityCodeLookup");

test("normalizeBrazilianCityName removes accents and collapses spaces", () => {
  assert.equal(normalizeBrazilianCityName("São  José dos Pinhais"), "sao jose dos pinhais");
  assert.equal(normalizeBrazilianCityName("Belo-Horizonte"), "belo horizonte");
});
