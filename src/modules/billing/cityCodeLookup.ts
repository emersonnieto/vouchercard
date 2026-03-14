const ibgeStateMunicipalitiesCache = new Map<string, Promise<IbgeCityRecord[]>>();

type ResolveCityCodeInput = {
  city: string;
  state: string;
};

type IbgeCityRecord = {
  id: number;
  nome: string;
};

export async function resolveIbgeCityCode(input: ResolveCityCodeInput) {
  const state = String(input.state ?? "").trim().toUpperCase();
  const city = String(input.city ?? "").trim();

  if (!state || !city) {
    return null;
  }

  const cities = await listIbgeCitiesByState(state);
  const target = normalizeBrazilianCityName(city);

  const exactMatch = cities.find((entry) => normalizeBrazilianCityName(entry.nome) === target);
  if (exactMatch) {
    return exactMatch.id;
  }

  const looseTarget = target.replace(/-/g, " ");
  const looseMatch = cities.find((entry) => {
    const normalized = normalizeBrazilianCityName(entry.nome).replace(/-/g, " ");
    return normalized === looseTarget;
  });

  return looseMatch?.id ?? null;
}

export function normalizeBrazilianCityName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function listIbgeCitiesByState(state: string) {
  if (!ibgeStateMunicipalitiesCache.has(state)) {
    ibgeStateMunicipalitiesCache.set(
      state,
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(state)}/municipios`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Falha ao consultar municipios do IBGE para ${state}.`);
          }

          return (await response.json()) as IbgeCityRecord[];
        })
    );
  }

  return ibgeStateMunicipalitiesCache.get(state)!;
}
