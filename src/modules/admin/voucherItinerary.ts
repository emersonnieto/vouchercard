import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
} from "../../lib/fetchWithTimeout";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_ITINERARY_TIMEOUT_MS = 12_000;
const DEFAULT_OPENAI_ITINERARY_MODEL = "gpt-5-mini";
const OPENAI_MAX_OUTPUT_TOKENS = 760;
const OPENAI_RETRY_MAX_OUTPUT_TOKENS = 980;
const MAX_SAVED_ITINERARY_CHARS = 2_800;

type VoucherFlightContext = {
  direction?: string | null;
  flightDate?: string | null;
  embarkAirport?: string | null;
  disembarkAirport?: string | null;
};

type VoucherTourContext = {
  tourDate?: string | null;
  location?: string | null;
};

export type VoucherItineraryContext = {
  tripDestination: string;
  hotelName?: string | null;
  hotelCity?: string | null;
  hotelCountry?: string | null;
  nights?: number | null;
  tours?: VoucherTourContext[];
  flights?: VoucherFlightContext[];
  additionalNotes?: string | null;
  transferReceptiveName?: string | null;
};

type ResponsesApiTextContent = {
  type?: string;
  text?: string;
};

type ResponsesApiOutputItem = {
  type?: string;
  content?: ResponsesApiTextContent[];
};

type ResponsesApiPayload = {
  model?: string;
  status?: string;
  output_text?: string;
  output?: ResponsesApiOutputItem[];
  incomplete_details?: {
    reason?: string;
  } | null;
};

export type GeneratedVoucherItinerary = {
  text: string;
  model: string;
  generatedAt: Date;
};

function asTrimmedString(value?: string | null) {
  const normalized = value?.trim();
  return normalized || "";
}

export function buildVoucherItineraryPrompt(context: VoucherItineraryContext) {
  const destination = asTrimmedString(context.tripDestination);
  const lines = [
    `Destino principal: ${destination}.`,
    "",
    "Escreva um roteiro sugestao curto em portugues do Brasil para aparecer em um app de voucher.",
    "Regras obrigatorias:",
    "- use somente o destino informado como base principal do roteiro",
    "- ignore voos, hotel, transfer, seguro e detalhes operacionais do voucher",
    "- nao mencione aeroportos, conexoes, embarque, origem do viajante ou companhias aereas",
    "- produza entre 160 e 280 palavras",
    "- use texto simples com 1 titulo curto e 4 blocos curtos com subtitulos",
    "- mantenha tom premium, acolhedor, elegante e confiavel",
    "- escreva como uma consultoria de viagem cuidadosa, sem soar artificial ou exagerada",
    "- priorize frases fluidas, vocabulario levemente sofisticado e leitura facil no celular",
    "- trate tudo como sugestao, nunca como confirmacao oficial",
    "- nao invente horarios exatos, precos, enderecos, contatos ou reservas",
    "- inclua ideias realistas para o primeiro contato com o destino, experiencias, organizacao dos dias e dicas praticas",
    "- destaque conforto, ritmo agradavel da viagem e pequenos toques de experiencia local",
    "- encerre com uma frase curta orientando confirmar detalhes com a agencia",
    "Responda apenas com o texto final.",
  ];

  return lines.filter((line): line is string => !!line).join("\n");
}

export function extractResponseOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const typedPayload = payload as ResponsesApiPayload;
  if (typeof typedPayload.output_text === "string") {
    return typedPayload.output_text.trim();
  }

  const outputItems = Array.isArray(typedPayload.output) ? typedPayload.output : [];
  const chunks: string[] = [];

  for (const item of outputItems) {
    if (!item || item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (!contentItem || typeof contentItem.text !== "string") {
        continue;
      }
      chunks.push(contentItem.text);
    }
  }

  return chunks.join("\n").trim();
}

export function normalizeGeneratedItinerary(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, MAX_SAVED_ITINERARY_CHARS)
    .trim();
}

export function isVoucherItineraryEnabled() {
  return !!process.env.OPENAI_API_KEY?.trim();
}

function getOpenAiItineraryModel() {
  return (
    process.env.OPENAI_VOUCHER_ITINERARY_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_OPENAI_ITINERARY_MODEL
  );
}

function responseWasTruncated(payload: ResponsesApiPayload) {
  return (
    payload.status === "incomplete" &&
    payload.incomplete_details?.reason === "max_output_tokens"
  );
}

async function requestVoucherItinerary(
  apiKey: string,
  model: string,
  context: VoucherItineraryContext,
  maxOutputTokens: number
) {
  const response = await fetchWithTimeout(
    OPENAI_RESPONSES_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: maxOutputTokens,
        instructions:
          "Voce escreve roteiros de viagem curtos para vouchers. Responda sempre em portugues do Brasil.",
        input: buildVoucherItineraryPrompt(context),
      }),
    },
    {
      serviceName: "OpenAI Responses API",
      timeoutMs: OPENAI_ITINERARY_TIMEOUT_MS,
    }
  );

  if (!response.ok) {
    const details = (await response.text()).slice(0, 400);
    throw new Error(`Falha ao gerar roteiro (${response.status}): ${details}`);
  }

  return (await response.json()) as ResponsesApiPayload;
}

export async function generateVoucherItinerary(
  context: VoucherItineraryContext
): Promise<GeneratedVoucherItinerary | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const tripDestination = asTrimmedString(context.tripDestination);

  if (!apiKey || !tripDestination) {
    return null;
  }

  const model = getOpenAiItineraryModel();
  const requestContext = {
    ...context,
    tripDestination,
  };
  let payload = await requestVoucherItinerary(
    apiKey,
    model,
    requestContext,
    OPENAI_MAX_OUTPUT_TOKENS
  );

  if (responseWasTruncated(payload)) {
    payload = await requestVoucherItinerary(
      apiKey,
      model,
      requestContext,
      OPENAI_RETRY_MAX_OUTPUT_TOKENS
    );
  }

  const text = normalizeGeneratedItinerary(extractResponseOutputText(payload));

  if (!text) {
    throw new Error("A OpenAI retornou o roteiro vazio.");
  }

  return {
    text,
    model: typeof payload.model === "string" ? payload.model : model,
    generatedAt: new Date(),
  };
}

export function getVoucherItineraryLogMessage(error: unknown) {
  if (error instanceof ExternalRequestTimeoutError) {
    return `${error.message} Timeout de ${error.timeoutMs}ms ao gerar roteiro.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Falha desconhecida ao gerar roteiro.";
}
