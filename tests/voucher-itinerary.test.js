const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildVoucherItineraryPrompt,
  extractResponseOutputText,
  normalizeGeneratedItinerary,
} = require("../src/modules/admin/voucherItinerary");

test("buildVoucherItineraryPrompt includes destination and voucher context", () => {
  const prompt = buildVoucherItineraryPrompt({
    tripDestination: "Lisboa",
    hotelName: "Hotel Central",
    hotelCity: "Lisboa",
    nights: 3,
    tours: [{ location: "Belem", tourDate: "2026-04-10" }],
    flights: [
      {
        direction: "OUTBOUND",
        embarkAirport: "GRU - Sao Paulo",
        disembarkAirport: "LIS - Lisboa",
        flightDate: "2026-04-09",
      },
    ],
    additionalNotes: "Cliente gosta de roteiro leve.",
  });

  assert.match(prompt, /Destino principal: Lisboa\./);
  assert.match(prompt, /Duracao estimada da estadia: 3 noites\./);
  assert.match(prompt, /Base de hospedagem informada: Hotel Central \| Lisboa\./);
  assert.match(prompt, /Passeios ja cadastrados no voucher: Belem em 2026-04-10\./);
  assert.match(prompt, /Cliente gosta de roteiro leve\./);
});

test("extractResponseOutputText prefers output_text when available", () => {
  const text = extractResponseOutputText({
    output_text: "Roteiro pronto",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: "Ignorar" }],
      },
    ],
  });

  assert.equal(text, "Roteiro pronto");
});

test("extractResponseOutputText falls back to nested message content", () => {
  const text = extractResponseOutputText({
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: "Chegada" },
          { type: "output_text", text: "Passeios" },
        ],
      },
    ],
  });

  assert.equal(text, "Chegada\nPasseios");
});

test("normalizeGeneratedItinerary trims and collapses extra blank lines", () => {
  const text = normalizeGeneratedItinerary("  Linha 1\r\n\r\n\r\nLinha 2  ");

  assert.equal(text, "Linha 1\n\nLinha 2");
});
