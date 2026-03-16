import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
} from "../../lib/fetchWithTimeout";

const POSTAL_LOOKUP_TIMEOUT_MS = 4_000;

type LookupPostalCodeInput = {
  countryCode?: unknown;
  postalCode?: unknown;
};

export async function lookupPostalCode(input: LookupPostalCodeInput) {
  const countryCode = String(input.countryCode ?? "BR").trim().toUpperCase();
  const postalCodeRaw = String(input.postalCode ?? "").trim();

  if (!postalCodeRaw) {
    return { ok: false as const, status: 400, message: "postalCode e obrigatorio" };
  }

  if (countryCode === "BR") {
    const cep = postalCodeRaw.replace(/\D/g, "");
    if (cep.length !== 8) {
      return { ok: false as const, status: 400, message: "CEP invalido. Use 8 digitos." };
    }

    try {
      const viaCepResponse = await fetchWithTimeout(
        `https://viacep.com.br/ws/${cep}/json/`,
        {},
        { serviceName: "ViaCEP", timeoutMs: POSTAL_LOOKUP_TIMEOUT_MS }
      );
      if (viaCepResponse.ok) {
        const viaCepData = (await viaCepResponse.json()) as {
          erro?: boolean;
          cep?: string;
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
        };

        if (!viaCepData.erro) {
          return {
            ok: true as const,
            data: {
              countryCode: "BR",
              country: "Brasil",
              postalCode: viaCepData.cep ?? cep,
              street: viaCepData.logradouro ?? null,
              neighborhood: viaCepData.bairro ?? null,
              city: viaCepData.localidade ?? null,
              state: viaCepData.uf ?? null,
            },
          };
        }
      }
    } catch {
      // segue para fallback
    }

    try {
      const brasilApiResponse = await fetchWithTimeout(
        `https://brasilapi.com.br/api/cep/v2/${cep}`,
        {},
        { serviceName: "BrasilAPI", timeoutMs: POSTAL_LOOKUP_TIMEOUT_MS }
      );
      if (brasilApiResponse.ok) {
        const brasilApiData = (await brasilApiResponse.json()) as {
          cep?: string;
          street?: string;
          neighborhood?: string;
          city?: string;
          state?: string;
        };

        return {
          ok: true as const,
          data: {
            countryCode: "BR",
            country: "Brasil",
            postalCode: brasilApiData.cep ?? cep,
            street: brasilApiData.street ?? null,
            neighborhood: brasilApiData.neighborhood ?? null,
            city: brasilApiData.city ?? null,
            state: brasilApiData.state ?? null,
          },
        };
      }

      if (brasilApiResponse.status === 404) {
        return { ok: false as const, status: 404, message: "CEP nao encontrado." };
      }
    } catch (error) {
      if (error instanceof ExternalRequestTimeoutError) {
        return {
          ok: false as const,
          status: 504,
          message: "Tempo limite ao consultar CEP externo.",
        };
      }

      return { ok: false as const, status: 502, message: "Falha ao consultar CEP externo." };
    }

    return { ok: false as const, status: 502, message: "Falha ao consultar CEP." };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `https://api.zippopotam.us/${encodeURIComponent(countryCode)}/${encodeURIComponent(postalCodeRaw)}`,
      {},
      { serviceName: "Zippopotam", timeoutMs: POSTAL_LOOKUP_TIMEOUT_MS }
    );
  } catch (error) {
    if (error instanceof ExternalRequestTimeoutError) {
      return {
        ok: false as const,
        status: 504,
        message: "Tempo limite ao consultar codigo postal externo.",
      };
    }

    return { ok: false as const, status: 502, message: "Falha ao consultar codigo postal externo." };
  }

  if (response.status === 404) {
    return { ok: false as const, status: 404, message: "Codigo postal nao encontrado." };
  }

  if (!response.ok) {
    return { ok: false as const, status: 502, message: "Falha ao consultar codigo postal." };
  }

  const data = (await response.json()) as {
    "country abbreviation"?: string;
    country?: string;
    "post code"?: string;
    places?: Array<{ "place name"?: string; state?: string }>;
  };
  const firstPlace = Array.isArray(data.places) ? data.places[0] : undefined;

  return {
    ok: true as const,
    data: {
      countryCode: data["country abbreviation"] ?? countryCode,
      country: data.country ?? countryCode,
      postalCode: data["post code"] ?? postalCodeRaw,
      street: null,
      neighborhood: null,
      city: firstPlace?.["place name"] ?? null,
      state: firstPlace?.state ?? null,
    },
  };
}
