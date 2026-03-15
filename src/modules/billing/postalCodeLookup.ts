type PostalCodeLookupData = {
  postalCode: string;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

export type BrazilianPostalCodeLookupResult =
  | {
      status: "ok";
      data: PostalCodeLookupData;
    }
  | {
      status: "not_found";
    }
  | {
      status: "unavailable";
    };

export async function lookupBrazilianPostalCode(
  postalCode: string
): Promise<BrazilianPostalCodeLookupResult> {
  const cep = String(postalCode ?? "").replace(/\D+/g, "");

  if (cep.length !== 8) {
    return { status: "not_found" };
  }

  let hadExternalFailure = false;

  try {
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (viaCepResponse.ok) {
      const viaCepData = (await viaCepResponse.json()) as {
        erro?: boolean;
        cep?: string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };

      if (viaCepData.erro) {
        return { status: "not_found" };
      }

      return {
        status: "ok",
        data: {
          postalCode: (viaCepData.cep ?? cep).replace(/\D+/g, ""),
          street: viaCepData.logradouro ?? null,
          neighborhood: viaCepData.bairro ?? null,
          city: viaCepData.localidade ?? null,
          state: viaCepData.uf ?? null,
        },
      };
    }

    if (viaCepResponse.status === 400 || viaCepResponse.status === 404) {
      return { status: "not_found" };
    }

    hadExternalFailure = true;
  } catch {
    hadExternalFailure = true;
  }

  try {
    const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (brasilApiResponse.ok) {
      const brasilApiData = (await brasilApiResponse.json()) as {
        cep?: string;
        street?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
      };

      return {
        status: "ok",
        data: {
          postalCode: (brasilApiData.cep ?? cep).replace(/\D+/g, ""),
          street: brasilApiData.street ?? null,
          neighborhood: brasilApiData.neighborhood ?? null,
          city: brasilApiData.city ?? null,
          state: brasilApiData.state ?? null,
        },
      };
    }

    if (brasilApiResponse.status === 400 || brasilApiResponse.status === 404) {
      return { status: "not_found" };
    }

    hadExternalFailure = true;
  } catch {
    hadExternalFailure = true;
  }

  return hadExternalFailure ? { status: "unavailable" } : { status: "not_found" };
}
