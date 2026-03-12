type VoucherPayloadInput = {
  reservationCode?: unknown;
  webCheckinCode?: unknown;
  clientName?: unknown;
  insuranceProvider?: unknown;
  insurancePhone?: unknown;
  insuranceEmail?: unknown;
  additionalNotes?: unknown;
  tours?: unknown;
  flights?: unknown;
  hotel?: unknown;
  transfer?: unknown;
};

export function sortFlights<T extends { direction: string; segmentOrder?: number | null }>(
  flights: T[]
) {
  const flightOrder: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };

  return [...flights].sort(
    (a, b) =>
      (flightOrder[a.direction] ?? 99) - (flightOrder[b.direction] ?? 99) ||
      (a.segmentOrder ?? 0) - (b.segmentOrder ?? 0)
  );
}

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = String(value).trim();
  return parsed || undefined;
}

function asOptionalInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const integerValue = Math.trunc(parsed);
  return integerValue >= 0 ? integerValue : undefined;
}

function asOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asOptionalString(item))
    .filter((item): item is string => !!item);
}

export function normalizeVoucherPayload(input: VoucherPayloadInput) {
  const {
    reservationCode,
    webCheckinCode,
    clientName,
    insuranceProvider,
    insurancePhone,
    insuranceEmail,
    additionalNotes,
    tours,
    flights,
    hotel,
    transfer,
  } = input;

  const hotelInput = (hotel ?? null) as
    | {
        hotelName?: unknown;
        email?: unknown;
        phones?: unknown;
        postalCode?: unknown;
        street?: unknown;
        hotelNumber?: unknown;
        neighborhood?: unknown;
        city?: unknown;
        state?: unknown;
        country?: unknown;
        nights?: unknown;
        checkInAt?: unknown;
        checkOutAt?: unknown;
        mealPlan?: unknown;
        roomType?: unknown;
      }
    | null;
  const transferInput = (transfer ?? null) as { receptiveName?: unknown } | null;
  const tourInputs = (Array.isArray(tours) ? tours : []) as Array<{
    tourDate?: unknown;
    departureTime?: unknown;
    location?: unknown;
    receptiveName?: unknown;
  }>;
  const flightInputs = (Array.isArray(flights) ? flights : []) as Array<{
    direction?: unknown;
    flightDate?: unknown;
    flightNumber?: unknown;
    departureTime?: unknown;
    arrivalTime?: unknown;
    embarkAirport?: unknown;
    disembarkAirport?: unknown;
    connections?: unknown;
  }>;

  if (!reservationCode || typeof reservationCode !== "string") {
    return { ok: false as const, status: 400, message: "reservationCode ÃƒÂ© obrigatÃƒÂ³rio" };
  }
  if (!clientName || typeof clientName !== "string") {
    return { ok: false as const, status: 400, message: "clientName ÃƒÂ© obrigatÃƒÂ³rio" };
  }
  if (!Array.isArray(flights) || flights.length < 1) {
    return { ok: false as const, status: 400, message: "flights ÃƒÂ© obrigatÃƒÂ³rio" };
  }

  const hasOutbound = flightInputs.some((flight) => flight?.direction === "OUTBOUND");
  const hasReturn = flightInputs.some((flight) => flight?.direction === "RETURN");
  if (!hasOutbound || !hasReturn) {
    return {
      ok: false as const,
      status: 400,
      message: "Inclua flights com direction OUTBOUND e RETURN",
    };
  }

  const flightsExpanded = flightInputs.flatMap((flightInput) => {
    const direction =
      flightInput.direction === "OUTBOUND" || flightInput.direction === "RETURN"
        ? flightInput.direction
        : null;

    if (!direction) return [];

    const finalDisembarkAirport = asOptionalString(flightInput.disembarkAirport);
    const connectionInputs = (
      Array.isArray(flightInput.connections) ? flightInput.connections : []
    ) as Array<{
      flightDate?: unknown;
      flightNumber?: unknown;
      embarkAirport?: unknown;
      disembarkAirport?: unknown;
      departureTime?: unknown;
      arrivalTime?: unknown;
    }>;

    const connections = connectionInputs
      .map((connectionInput) => ({
        flightDate: asOptionalString(connectionInput.flightDate),
        flightNumber: asOptionalString(connectionInput.flightNumber),
        embarkAirport: asOptionalString(connectionInput.embarkAirport),
        disembarkAirport: asOptionalString(connectionInput.disembarkAirport),
        departureTime: asOptionalString(connectionInput.departureTime),
        arrivalTime: asOptionalString(connectionInput.arrivalTime),
      }))
      .filter(
        (connection) =>
          !!connection.flightDate ||
          !!connection.embarkAirport ||
          !!connection.disembarkAirport ||
          !!connection.flightNumber ||
          !!connection.departureTime ||
          !!connection.arrivalTime
      );

    const rows = [
      {
        direction,
        segmentOrder: 0,
        flightDate: asOptionalString(flightInput.flightDate),
        flightNumber: asOptionalString(flightInput.flightNumber),
        departureTime: asOptionalString(flightInput.departureTime),
        arrivalTime: asOptionalString(flightInput.arrivalTime),
        embarkAirport: asOptionalString(flightInput.embarkAirport),
        disembarkAirport: finalDisembarkAirport,
      },
    ];

    connections.forEach((connection, index) => {
      rows.push({
        direction,
        segmentOrder: index + 1,
        flightDate: connection.flightDate,
        flightNumber: connection.flightNumber,
        departureTime: connection.departureTime,
        arrivalTime: connection.arrivalTime,
        embarkAirport: connection.embarkAirport,
        disembarkAirport: connection.disembarkAirport,
      });
    });

    return rows;
  });

  const normalizedTours = tourInputs
    .map((tourInput, index) => ({
      sortOrder: index,
      tourDate: asOptionalString(tourInput.tourDate) ?? null,
      departureTime: asOptionalString(tourInput.departureTime) ?? null,
      location: asOptionalString(tourInput.location) ?? null,
      receptiveName: asOptionalString(tourInput.receptiveName) ?? null,
    }))
    .filter(
      (tour) =>
        !!tour.tourDate || !!tour.departureTime || !!tour.location || !!tour.receptiveName
    );

  const hasHotelData =
    !!asOptionalString(hotelInput?.hotelName) ||
    !!asOptionalString(hotelInput?.email) ||
    asOptionalStringArray(hotelInput?.phones).length > 0 ||
    !!asOptionalString(hotelInput?.postalCode) ||
    !!asOptionalString(hotelInput?.street) ||
    !!asOptionalString(hotelInput?.hotelNumber) ||
    !!asOptionalString(hotelInput?.neighborhood) ||
    !!asOptionalString(hotelInput?.city) ||
    !!asOptionalString(hotelInput?.state) ||
    !!asOptionalString(hotelInput?.country) ||
    asOptionalInteger(hotelInput?.nights) !== undefined ||
    !!asOptionalString(hotelInput?.checkInAt) ||
    !!asOptionalString(hotelInput?.checkOutAt) ||
    !!asOptionalString(hotelInput?.mealPlan) ||
    !!asOptionalString(hotelInput?.roomType);

  if (hasHotelData && !asOptionalString(hotelInput?.hotelName)) {
    return { ok: false as const, status: 400, message: "hotel.hotelName ÃƒÂ© obrigatÃƒÂ³rio" };
  }

  return {
    ok: true as const,
    data: {
      reservationCode: reservationCode.trim(),
      webCheckinCode: asOptionalString(webCheckinCode) ?? null,
      clientName: clientName.trim(),
      insuranceProvider: asOptionalString(insuranceProvider) ?? null,
      insurancePhone: asOptionalString(insurancePhone) ?? null,
      insuranceEmail: asOptionalString(insuranceEmail) ?? null,
      additionalNotes: asOptionalString(additionalNotes) ?? null,
      tours: normalizedTours,
      flights: flightsExpanded,
      hotel: hasHotelData
        ? {
            hotelName: asOptionalString(hotelInput?.hotelName) ?? "",
            email: asOptionalString(hotelInput?.email) ?? null,
            phones: asOptionalStringArray(hotelInput?.phones),
            postalCode: asOptionalString(hotelInput?.postalCode) ?? null,
            street: asOptionalString(hotelInput?.street) ?? null,
            hotelNumber: asOptionalString(hotelInput?.hotelNumber) ?? null,
            neighborhood: asOptionalString(hotelInput?.neighborhood) ?? null,
            city: asOptionalString(hotelInput?.city) ?? null,
            state: asOptionalString(hotelInput?.state) ?? null,
            country: asOptionalString(hotelInput?.country) ?? null,
            nights: asOptionalInteger(hotelInput?.nights) ?? null,
            checkInAt: asOptionalString(hotelInput?.checkInAt) ?? null,
            checkOutAt: asOptionalString(hotelInput?.checkOutAt) ?? null,
            mealPlan: asOptionalString(hotelInput?.mealPlan) ?? null,
            roomType: asOptionalString(hotelInput?.roomType) ?? null,
          }
        : null,
      transfer: asOptionalString(transferInput?.receptiveName)
        ? { receptiveName: asOptionalString(transferInput?.receptiveName) ?? null }
        : null,
    },
  };
}
