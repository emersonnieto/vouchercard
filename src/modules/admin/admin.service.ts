import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { RlsDbClient } from "../../lib/rls";
import { resolveAgencyUserRole } from "../../auth/userRoles";
import { lookupPostalCode as lookupPostalCodeService } from "./postalLookup";
import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
} from "../../lib/fetchWithTimeout";
import {
  getVoucherItineraryLogMessage,
  generateVoucherItinerary,
} from "./voucherItinerary";
import {
  BillingIntegrationError,
  BillingValidationError,
  cancelAgencySubscription,
  getAgencySubscriptionSummary,
} from "../billing/billing.service";

type CreateAgencyInput = {
  name?: unknown;
  slug?: unknown;
  phone?: unknown;
  email?: unknown;
};

type UpdateAgencyStatusInput = {
  agencyId: string;
  isActive?: unknown;
};

type UpdateAgencyBrandingInput = {
  agencyId: string;
  logoUrl?: unknown;
  primaryColor?: unknown;
};

type UploadAgencyLogoInput = {
  agencyId: string;
  fileName?: unknown;
  contentType?: unknown;
  dataBase64?: unknown;
};

type CreateAgencyUserInput = {
  agencyId: string;
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
};

type CreateVoucherInput = {
  agencyId: string;
  reservationCode?: unknown;
  webCheckinCode?: unknown;
  clientName?: unknown;
  tripDestination?: unknown;
  insuranceProvider?: unknown;
  insurancePhone?: unknown;
  insuranceEmail?: unknown;
  additionalNotes?: unknown;
  tours?: unknown;
  flights?: unknown;
  hotel?: unknown;
  transfer?: unknown;
};

type UpdateVoucherInput = {
  agencyId: string;
  id: string;
  reservationCode?: unknown;
  webCheckinCode?: unknown;
  clientName?: unknown;
  tripDestination?: unknown;
  insuranceProvider?: unknown;
  insurancePhone?: unknown;
  insuranceEmail?: unknown;
  additionalNotes?: unknown;
  tours?: unknown;
  flights?: unknown;
  hotel?: unknown;
  transfer?: unknown;
};

const flightOrder: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
const MAX_LOGO_BYTES = 7 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);
const PUBLIC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PUBLIC_CODE_LENGTH = 8;
const MAX_PUBLIC_CODE_ATTEMPTS = 12;
const SUPABASE_TIMEOUT_MS = 15_000;

type AdminDbClient = RlsDbClient | typeof prisma;

const voucherCreateInclude = {
  flights: true,
  tours: true,
  hotel: true,
  transfer: true,
  agency: {
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      email: true,
      isActive: true,
      logoUrl: true,
      primaryColor: true,
    },
  },
} as const;

type VoucherItineraryPayload = {
  tripDestination?: string | null;
  additionalNotes?: string | null;
  flights: Array<{
    direction: string;
    flightDate?: string | null;
    embarkAirport?: string | null;
    disembarkAirport?: string | null;
  }>;
  tours: Array<{
    tourDate?: string | null;
    location?: string | null;
  }>;
  hotel?:
    | {
        hotelName: string;
        city?: string | null;
        country?: string | null;
        nights?: number | null;
      }
    | null;
  transfer?:
    | {
        receptiveName?: string | null;
      }
    | null;
};

type VoucherItineraryPostProcess = {
  voucherId: string;
  agencyId: string;
  itineraryContext: ReturnType<typeof buildVoucherItineraryContext>;
};

type VoucherMutationSuccess<T> = {
  ok: true;
  status?: number;
  data: T;
  postProcess?: VoucherItineraryPostProcess;
};

function sortFlights<T extends { direction: string; segmentOrder?: number | null }>(flights: T[]) {
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

function generatePublicCodeCandidate() {
  const bytes = randomBytes(PUBLIC_CODE_LENGTH);
  let code = "";

  for (let i = 0; i < PUBLIC_CODE_LENGTH; i += 1) {
    code += PUBLIC_CODE_ALPHABET[bytes[i] % PUBLIC_CODE_ALPHABET.length];
  }

  return code;
}

async function generateUniquePublicCode(db: AdminDbClient) {
  for (let i = 0; i < MAX_PUBLIC_CODE_ATTEMPTS; i += 1) {
    const candidate = generatePublicCodeCandidate();
    const existing = await db.voucher.findUnique({
      where: { publicCode: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Falha ao gerar codigo publico unico do voucher.");
}

function buildVoucherItineraryContext(data: VoucherItineraryPayload) {
  return {
    tripDestination: data.tripDestination ?? "",
    hotelName: data.hotel?.hotelName,
    hotelCity: data.hotel?.city,
    hotelCountry: data.hotel?.country,
    nights: data.hotel?.nights,
    tours: data.tours,
    flights: data.flights,
    additionalNotes: data.additionalNotes,
    transferReceptiveName: data.transfer?.receptiveName,
  };
}

function normalizeVoucherPayload(
  input: Omit<CreateVoucherInput, "agencyId">,
) {
  const {
    reservationCode,
    webCheckinCode,
    clientName,
    tripDestination,
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
    return { ok: false as const, status: 400, message: "reservationCode Ã© obrigatÃ³rio" };
  }
  if (!clientName || typeof clientName !== "string") {
    return { ok: false as const, status: 400, message: "clientName Ã© obrigatÃ³rio" };
  }
  if (!Array.isArray(flights) || flights.length < 1) {
    return { ok: false as const, status: 400, message: "flights Ã© obrigatÃ³rio" };
  }

  if (!Array.isArray(flights) || flights.length < 1) {
    return { ok: false as const, status: 400, message: "flights Ã© obrigatÃ³rio" };
  }



  const hasOutbound = flightInputs.some((f) => f?.direction === "OUTBOUND");
  const hasReturn = flightInputs.some((f) => f?.direction === "RETURN");
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
    return { ok: false as const, status: 400, message: "hotel.hotelName Ã© obrigatÃ³rio" };
  }

  return {
    ok: true as const,
    data: {
      reservationCode: reservationCode.trim(),
      webCheckinCode: asOptionalString(webCheckinCode) ?? null,
      clientName: clientName.trim(),
      tripDestination: asOptionalString(tripDestination) ?? null,
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

function getLogoExtension(fileName: string | undefined, contentType: string) {
  const fromFileName = fileName?.split(".").pop()?.trim().toLowerCase();
  if (fromFileName && ["png", "jpg", "jpeg", "webp", "svg"].includes(fromFileName)) {
    return fromFileName === "jpeg" ? "jpg" : fromFileName;
  }

  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/svg+xml") return "svg";
  return "jpg";
}

function getSupabaseStorageEnv() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return { supabaseUrl, serviceRoleKey };
}

export async function getMe(userId: string, db: AdminDbClient = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      agencyId: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const agency = user.agencyId
    ? await db.agency.findUnique({
        where: { id: user.agencyId },
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          email: true,
          createdAt: true,
          isActive: true,
          logoUrl: true,
          primaryColor: true,
        },
      })
    : null;

  return { user, agency };
}

export async function getAgencySubscription(
  agencyId: string,
  db: AdminDbClient = prisma
) {
  if (!agencyId) {
    return {
      ok: false as const,
      status: 400,
      message: "Sua conta nao possui agencia vinculada.",
    };
  }

  const subscription = await getAgencySubscriptionSummary(agencyId, db);
  return { ok: true as const, data: subscription };
}

export async function cancelAgencySubscriptionAtPeriodEnd(
  agencyId: string,
  db: AdminDbClient = prisma
) {
  if (!agencyId) {
    return {
      ok: false as const,
      status: 400,
      message: "Sua conta nao possui agencia vinculada.",
    };
  }

  try {
    const subscription = await cancelAgencySubscription(agencyId, db);
    return { ok: true as const, data: subscription };
  } catch (error) {
    if (error instanceof BillingValidationError) {
      return {
        ok: false as const,
        status: 400,
        message: error.message,
      };
    }

    if (error instanceof BillingIntegrationError) {
      return {
        ok: false as const,
        status: 502,
        message: error.message,
      };
    }

    throw error;
  }
}

export async function listAgencies(db: AdminDbClient = prisma) {
  return db.agency.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      createdAt: true,
      isActive: true,
      logoUrl: true,
      primaryColor: true,
    },
  });
}

export async function createAgency(
  input: CreateAgencyInput,
  db: AdminDbClient = prisma
) {
  const { name, slug, phone, email } = input;

  if (!name || typeof name !== "string") {
    return { ok: false as const, status: 400, message: "name é obrigatório" };
  }
  if (!slug || typeof slug !== "string") {
    return { ok: false as const, status: 400, message: "slug é obrigatório" };
  }

  try {
    const agency = await db.agency.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        phone: phone ? String(phone) : null,
        email: email ? String(email) : null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        email: true,
        createdAt: true,
        isActive: true,
        logoUrl: true,
        primaryColor: true,
      },
    });

    return { ok: true as const, status: 201, data: agency };
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { ok: false as const, status: 409, message: "Slug já existe" };
    }
    throw err;
  }
}

export async function updateAgencyStatus(
  input: UpdateAgencyStatusInput,
  db: AdminDbClient = prisma
) {
  const { agencyId, isActive } = input;

  if (!agencyId) {
    return { ok: false as const, status: 400, message: "agencyId inválido" };
  }
  if (typeof isActive !== "boolean") {
    return { ok: false as const, status: 400, message: "isActive deve ser boolean" };
  }

  try {
    const updated = await db.agency.update({
      where: { id: agencyId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        createdAt: true,
        isActive: true,
        logoUrl: true,
        primaryColor: true,
      },
    });

    return { ok: true as const, data: updated };
  } catch (err: any) {
    if (err?.code === "P2025") {
      return { ok: false as const, status: 404, message: "Agencia nao encontrada" };
    }
    throw err;
  }
}

export async function updateAgencyBranding(
  input: UpdateAgencyBrandingInput,
  db: AdminDbClient = prisma
) {
  const { agencyId, logoUrl, primaryColor } = input;

  if (!agencyId) {
    return { ok: false as const, status: 400, message: "agencyId inválido" };
  }

  const logoUrlFinal =
    logoUrl === undefined ? undefined : logoUrl === null ? null : String(logoUrl);
  const primaryColorFinal =
    primaryColor === undefined
      ? undefined
      : primaryColor === null
      ? null
      : String(primaryColor);

  try {
    const updated = await db.agency.update({
      where: { id: agencyId },
      data: {
        logoUrl: logoUrlFinal,
        primaryColor: primaryColorFinal,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        createdAt: true,
        isActive: true,
        logoUrl: true,
        primaryColor: true,
      },
    });

    return { ok: true as const, data: updated };
  } catch (err: any) {
    if (err?.code === "P2025") {
      return { ok: false as const, status: 404, message: "Agencia nao encontrada" };
    }
    throw err;
  }
}

export async function uploadAgencyLogo(
  input: UploadAgencyLogoInput,
  db: AdminDbClient = prisma
) {
  const { agencyId, fileName, contentType, dataBase64 } = input;

  if (!agencyId) {
    return { ok: false as const, status: 400, message: "agencyId inválido" };
  }

  if (!contentType || typeof contentType !== "string" || !ALLOWED_LOGO_TYPES.has(contentType)) {
    return {
      ok: false as const,
      status: 400,
      message: "Formato inválido. Use PNG, JPG, WEBP ou SVG.",
    };
  }

  if (!dataBase64 || typeof dataBase64 !== "string") {
    return { ok: false as const, status: 400, message: "Arquivo inválido" };
  }

  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { id: true },
  });

  if (!agency) {
    return { ok: false as const, status: 404, message: "Agência não encontrada" };
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(dataBase64, "base64");
  } catch {
    return { ok: false as const, status: 400, message: "Arquivo inválido" };
  }

  if (!fileBuffer.length || fileBuffer.length > MAX_LOGO_BYTES) {
    return {
      ok: false as const,
      status: 400,
      message: "Arquivo grande demais. Máximo: 7MB.",
    };
  }

  const ext = getLogoExtension(
    typeof fileName === "string" ? fileName : undefined,
    contentType
  );
  const storageEnv = getSupabaseStorageEnv();
  if (!storageEnv) {
    return {
      ok: false as const,
      status: 503,
      message:
        "Upload de logo indisponível. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na API.",
    };
  }

  const { supabaseUrl, serviceRoleKey } = storageEnv;
  const path = `${agencyId}/logo.${ext}`;

  let uploadResponse: Response;

  try {
    uploadResponse = await fetchWithTimeout(
      `${supabaseUrl}/storage/v1/object/agency-logos/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: new Uint8Array(fileBuffer),
      },
      { serviceName: "Supabase Storage", timeoutMs: SUPABASE_TIMEOUT_MS }
    );
  } catch (error) {
    if (error instanceof ExternalRequestTimeoutError) {
      return {
        ok: false as const,
        status: 504,
        message: "Tempo limite ao enviar logo para o storage.",
      };
    }

    throw error;
  }

  if (!uploadResponse.ok) {
    const details = await uploadResponse.text().catch(() => "");
    console.error("[SUPABASE] logo upload falhou:", uploadResponse.status, details);
    return {
      ok: false as const,
      status: 502,
      message: "Falha ao enviar logo para o storage.",
    };
  }

  return {
    ok: true as const,
    data: {
      url: `${supabaseUrl}/storage/v1/object/public/agency-logos/${path}`,
    },
  };
}

export async function createAgencyUser(
  input: CreateAgencyUserInput,
  db: AdminDbClient = prisma
) {
  const { agencyId, name, email, password, role } = input;

  if (!agencyId) {
    return { ok: false as const, status: 400, message: "agencyId inválido" };
  }
  if (!name || typeof name !== "string") {
    return { ok: false as const, status: 400, message: "name é obrigatório" };
  }
  if (!email || typeof email !== "string") {
    return { ok: false as const, status: 400, message: "email é obrigatório" };
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return { ok: false as const, status: 400, message: "password é obrigatório (mín 6)" };
  }

  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { id: true },
  });
  if (!agency) {
    return { ok: false as const, status: 404, message: "Agência não encontrada" };
  }

  const resolvedRole = resolveAgencyUserRole(role);
  if (!resolvedRole.ok) {
    return { ok: false as const, status: 400, message: resolvedRole.message };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const finalRole = resolvedRole.role;

  try {
    const user = await db.user.create({
      data: {
        agencyId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: finalRole,
      },
      select: {
        id: true,
        agencyId: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return { ok: true as const, status: 201, data: user };
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { ok: false as const, status: 409, message: "Email já existe" };
    }
    throw err;
  }
}

export async function createVoucher(
  input: CreateVoucherInput,
  db: AdminDbClient = prisma
) {
  const { agencyId } = input;

  if (!agencyId) {
    return {
      ok: false as const,
      status: 400,
      message: "Seu usuário não possui agencyId vinculado. Contate o suporte.",
    };
  }

  const normalized = normalizeVoucherPayload(input);
  if (!normalized.ok) {
    return normalized;
  }

  try {
    const publicCode = await generateUniquePublicCode(db);

    const created = await db.voucher.create({
      data: {
        agencyId,
        publicCode,
        reservationCode: normalized.data.reservationCode,
        webCheckinCode: normalized.data.webCheckinCode,
        clientName: normalized.data.clientName,
        tripDestination: normalized.data.tripDestination,
        insuranceProvider: normalized.data.insuranceProvider,
        insurancePhone: normalized.data.insurancePhone,
        insuranceEmail: normalized.data.insuranceEmail,
        additionalNotes: normalized.data.additionalNotes,
        flights: {
          create: normalized.data.flights.map((flight) => ({
            direction: flight.direction,
            segmentOrder: flight.segmentOrder,
            flightDate: flight.flightDate,
            flightNumber: flight.flightNumber,
            departureTime: flight.departureTime,
            arrivalTime: flight.arrivalTime,
            embarkAirport: flight.embarkAirport,
            disembarkAirport: flight.disembarkAirport,
          })),
        },
        tours: {
          create: normalized.data.tours.map((tour) => ({
            sortOrder: tour.sortOrder,
            tourDate: tour.tourDate,
            departureTime: tour.departureTime,
            location: tour.location,
            receptiveName: tour.receptiveName,
          })),
        },
        hotel: normalized.data.hotel
          ? {
              create: {
                hotelName: normalized.data.hotel.hotelName,
                email: normalized.data.hotel.email,
                phones: normalized.data.hotel.phones,
                postalCode: normalized.data.hotel.postalCode,
                street: normalized.data.hotel.street,
                hotelNumber: normalized.data.hotel.hotelNumber,
                neighborhood: normalized.data.hotel.neighborhood,
                city: normalized.data.hotel.city,
                state: normalized.data.hotel.state,
                country: normalized.data.hotel.country,
                nights: normalized.data.hotel.nights,
                checkInAt: normalized.data.hotel.checkInAt,
                checkOutAt: normalized.data.hotel.checkOutAt,
                mealPlan: normalized.data.hotel.mealPlan,
                roomType: normalized.data.hotel.roomType,
              },
            }
          : undefined,
        transfer: normalized.data.transfer
          ? { create: { receptiveName: normalized.data.transfer.receptiveName } }
          : undefined,
      },
      include: voucherCreateInclude,
    });

    const result: VoucherMutationSuccess<typeof created> = {
      ok: true as const,
      status: 201,
      data: {
        ...created,
        flights: sortFlights(created.flights),
        tours: [...created.tours].sort((a, b) => a.sortOrder - b.sortOrder),
      },
    };

    if (normalized.data.tripDestination) {
      result.postProcess = {
        voucherId: created.id,
        agencyId,
        itineraryContext: buildVoucherItineraryContext(normalized.data),
      };
    }

    return result;
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { ok: false as const, status: 409, message: "reservationCode já existe" };
    }
    throw err;
  }
}

export async function updateVoucher(
  input: UpdateVoucherInput,
  db: AdminDbClient = prisma
) {
  const { agencyId, id } = input;

  if (!agencyId) {
    return {
      ok: false as const,
      status: 400,
      message: "Seu usuÃ¡rio nÃ£o possui agencyId vinculado. Contate o suporte.",
    };
  }
  if (!id) {
    return { ok: false as const, status: 400, message: "ID invÃ¡lido" };
  }

  const existing = await db.voucher.findFirst({
    where: { id, agencyId },
    select: {
      id: true,
      tripDestination: true,
      itinerarySuggestion: true,
    },
  });

  if (!existing) {
    return { ok: false as const, status: 404, message: "Voucher nÃ£o encontrado" };
  }

  const normalized = normalizeVoucherPayload(input);
  if (!normalized.ok) {
    return normalized;
  }

  const nextTripDestination = normalized.data.tripDestination ?? null;
  const currentTripDestination = existing.tripDestination?.trim() || null;
  const tripDestinationChanged = currentTripDestination !== nextTripDestination;
  const shouldResetItinerary = !nextTripDestination || tripDestinationChanged;
  const shouldGenerateItinerary =
    !!nextTripDestination &&
    (tripDestinationChanged || !existing.itinerarySuggestion?.trim());

  try {
    await db.voucher.update({
      where: { id },
      data: {
        reservationCode: normalized.data.reservationCode,
        webCheckinCode: normalized.data.webCheckinCode,
        clientName: normalized.data.clientName,
        tripDestination: nextTripDestination,
        insuranceProvider: normalized.data.insuranceProvider,
        insurancePhone: normalized.data.insurancePhone,
        insuranceEmail: normalized.data.insuranceEmail,
        additionalNotes: normalized.data.additionalNotes,
        ...(shouldResetItinerary
          ? {
              itinerarySuggestion: null,
              itineraryGeneratedAt: null,
              itineraryModel: null,
            }
          : {}),
      },
    });

    await db.flight.deleteMany({ where: { voucherId: id } });
    await db.tour.deleteMany({ where: { voucherId: id } });

    await db.flight.createMany({
      data: normalized.data.flights.map((flight) => ({
        voucherId: id,
        direction: flight.direction as "OUTBOUND" | "RETURN",
        segmentOrder: flight.segmentOrder,
        flightDate: flight.flightDate,
        flightNumber: flight.flightNumber,
        departureTime: flight.departureTime,
        arrivalTime: flight.arrivalTime,
        embarkAirport: flight.embarkAirport,
        disembarkAirport: flight.disembarkAirport,
      })),
    });

    if (normalized.data.tours.length) {
      await db.tour.createMany({
        data: normalized.data.tours.map((tour) => ({
          voucherId: id,
          sortOrder: tour.sortOrder,
          tourDate: tour.tourDate,
          departureTime: tour.departureTime,
          location: tour.location,
          receptiveName: tour.receptiveName,
        })),
      });
    }

    if (normalized.data.hotel) {
      await db.hotel.upsert({
        where: { voucherId: id },
        create: {
          voucherId: id,
          hotelName: normalized.data.hotel.hotelName,
          email: normalized.data.hotel.email,
          phones: normalized.data.hotel.phones,
          postalCode: normalized.data.hotel.postalCode,
          street: normalized.data.hotel.street,
          hotelNumber: normalized.data.hotel.hotelNumber,
          neighborhood: normalized.data.hotel.neighborhood,
          city: normalized.data.hotel.city,
          state: normalized.data.hotel.state,
          country: normalized.data.hotel.country,
          nights: normalized.data.hotel.nights,
          checkInAt: normalized.data.hotel.checkInAt,
          checkOutAt: normalized.data.hotel.checkOutAt,
          mealPlan: normalized.data.hotel.mealPlan,
          roomType: normalized.data.hotel.roomType,
        },
        update: {
          hotelName: normalized.data.hotel.hotelName,
          email: normalized.data.hotel.email,
          phones: normalized.data.hotel.phones,
          postalCode: normalized.data.hotel.postalCode,
          street: normalized.data.hotel.street,
          hotelNumber: normalized.data.hotel.hotelNumber,
          neighborhood: normalized.data.hotel.neighborhood,
          city: normalized.data.hotel.city,
          state: normalized.data.hotel.state,
          country: normalized.data.hotel.country,
          nights: normalized.data.hotel.nights,
          checkInAt: normalized.data.hotel.checkInAt,
          checkOutAt: normalized.data.hotel.checkOutAt,
          mealPlan: normalized.data.hotel.mealPlan,
          roomType: normalized.data.hotel.roomType,
        },
      });
    } else {
      await db.hotel.deleteMany({ where: { voucherId: id } });
    }

    if (normalized.data.transfer) {
      await db.transfer.upsert({
        where: { voucherId: id },
        create: {
          voucherId: id,
          receptiveName: normalized.data.transfer.receptiveName,
        },
        update: {
          receptiveName: normalized.data.transfer.receptiveName,
        },
      });
    } else {
      await db.transfer.deleteMany({ where: { voucherId: id } });
    }

    const updated = await db.voucher.findFirst({
      where: { id, agencyId },
      include: { flights: true, tours: true, hotel: true, transfer: true },
    });

    if (!updated) {
      return { ok: false as const, status: 404, message: "Voucher nÃ£o encontrado" };
    }

    const result: VoucherMutationSuccess<typeof updated> = {
      ok: true as const,
      data: {
        ...updated,
        flights: sortFlights(updated.flights),
        tours: [...updated.tours].sort((a, b) => a.sortOrder - b.sortOrder),
      },
    };

    if (shouldGenerateItinerary) {
      result.postProcess = {
        voucherId: id,
        agencyId,
        itineraryContext: buildVoucherItineraryContext(normalized.data),
      };
    }

    return result;
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { ok: false as const, status: 409, message: "reservationCode jÃ¡ existe" };
    }
    throw err;
  }
}

export async function persistVoucherItinerary(
  input: {
    agencyId: string;
    voucherId: string;
    generatedItinerary: {
      text: string;
      model: string;
      generatedAt: Date;
    };
  },
  db: AdminDbClient = prisma
) {
  const voucher = await db.voucher.findFirst({
    where: { id: input.voucherId, agencyId: input.agencyId },
    select: { id: true },
  });

  if (!voucher) {
    return {
      ok: false as const,
      status: 404,
      message: "Voucher nao encontrado para salvar o roteiro.",
    };
  }

  const updated = await db.voucher.update({
    where: { id: input.voucherId },
    data: {
      itinerarySuggestion: input.generatedItinerary.text,
      itineraryGeneratedAt: input.generatedItinerary.generatedAt,
      itineraryModel: input.generatedItinerary.model,
    },
  });

  return {
    ok: true as const,
    data: updated,
  };
}

export async function generateVoucherItineraryForContext(
  context: ReturnType<typeof buildVoucherItineraryContext>
) {
  return generateVoucherItinerary(context);
}

export { getVoucherItineraryLogMessage };

export async function listVouchers(
  agencyId: string,
  db: AdminDbClient = prisma
) {
  if (!agencyId) {
    return {
      ok: false as const,
      status: 400,
      message: "Seu usuário não possui agencyId vinculado. Contate o suporte.",
    };
  }

  const vouchers = await db.voucher.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
  });

  return { ok: true as const, data: vouchers };
}

export async function getVoucherById(
  agencyId: string,
  id: string,
  db: AdminDbClient = prisma
) {
  if (!agencyId) {
    return {
      ok: false as const,
      status: 400,
      message: "Seu usuário não possui agencyId vinculado.",
    };
  }
  if (!id) {
    return { ok: false as const, status: 400, message: "ID inválido" };
  }

  const voucher = await db.voucher.findFirst({
    where: { id, agencyId },
    include: { flights: true, tours: true, hotel: true, transfer: true },
  });

  if (!voucher) {
    return { ok: false as const, status: 404, message: "Voucher não encontrado" };
  }

  return {
    ok: true as const,
    data: {
      ...voucher,
      flights: sortFlights(voucher.flights),
      tours: [...voucher.tours].sort((a, b) => a.sortOrder - b.sortOrder),
    },
  };
}

export const lookupPostalCode = lookupPostalCodeService;

