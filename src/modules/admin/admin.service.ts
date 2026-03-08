import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma";

type UserRole = "SUPERADMIN" | "ADMIN";

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
  flights?: unknown;
  hotel?: unknown;
  transfer?: unknown;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "SUPERADMIN" || value === "ADMIN";
}

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

async function generateUniquePublicCode() {
  for (let i = 0; i < MAX_PUBLIC_CODE_ATTEMPTS; i += 1) {
    const candidate = generatePublicCodeCandidate();
    const existing = await prisma.voucher.findUnique({
      where: { publicCode: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Falha ao gerar codigo publico unico do voucher.");
}

function normalizeVoucherPayload(
  input: Omit<CreateVoucherInput, "agencyId">,
) {
  const { reservationCode, webCheckinCode, clientName, flights, hotel, transfer } = input;

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
        checkInTime?: unknown;
        checkOutTime?: unknown;
      }
    | null;
  const transferInput = (transfer ?? null) as { receptiveName?: unknown } | null;
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
    !!asOptionalString(hotelInput?.roomType) ||
    !!asOptionalString(hotelInput?.checkInTime) ||
    !!asOptionalString(hotelInput?.checkOutTime);

  if (hasHotelData && !asOptionalString(hotelInput?.hotelName)) {
    return { ok: false as const, status: 400, message: "hotel.hotelName Ã© obrigatÃ³rio" };
  }

  return {
    ok: true as const,
    data: {
      reservationCode: reservationCode.trim(),
      webCheckinCode: asOptionalString(webCheckinCode) ?? null,
      clientName: clientName.trim(),
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
            checkInTime: asOptionalString(hotelInput?.checkInTime) ?? null,
            checkOutTime: asOptionalString(hotelInput?.checkOutTime) ?? null,
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

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
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
    ? await prisma.agency.findUnique({
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

export async function listAgencies() {
  return prisma.agency.findMany({
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

export async function createAgency(input: CreateAgencyInput) {
  const { name, slug, phone, email } = input;

  if (!name || typeof name !== "string") {
    return { ok: false as const, status: 400, message: "name é obrigatório" };
  }
  if (!slug || typeof slug !== "string") {
    return { ok: false as const, status: 400, message: "slug é obrigatório" };
  }

  try {
    const agency = await prisma.agency.create({
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

export async function updateAgencyStatus(input: UpdateAgencyStatusInput) {
  const { agencyId, isActive } = input;

  if (!agencyId) {
    return { ok: false as const, status: 400, message: "agencyId inválido" };
  }
  if (typeof isActive !== "boolean") {
    return { ok: false as const, status: 400, message: "isActive deve ser boolean" };
  }

  try {
    const updated = await prisma.agency.update({
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

export async function updateAgencyBranding(input: UpdateAgencyBrandingInput) {
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
    const updated = await prisma.agency.update({
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

export async function uploadAgencyLogo(input: UploadAgencyLogoInput) {
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

  const agency = await prisma.agency.findUnique({
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

  const uploadResponse = await fetch(
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
    }
  );

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

export async function createAgencyUser(input: CreateAgencyUserInput) {
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

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true },
  });
  if (!agency) {
    return { ok: false as const, status: 404, message: "Agência não encontrada" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const finalRole: UserRole = isUserRole(role) ? role : "ADMIN";

  try {
    const user = await prisma.user.create({
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

export async function createVoucher(input: CreateVoucherInput) {
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
    const publicCode = await generateUniquePublicCode();

    const created = await prisma.voucher.create({
      data: {
        agencyId,
        publicCode,
        reservationCode: normalized.data.reservationCode,
        webCheckinCode: normalized.data.webCheckinCode,
        clientName: normalized.data.clientName,
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
                checkInTime: normalized.data.hotel.checkInTime,
                checkOutTime: normalized.data.hotel.checkOutTime,
              },
            }
          : undefined,
        transfer: normalized.data.transfer
          ? { create: { receptiveName: normalized.data.transfer.receptiveName } }
          : undefined,
      },
      include: {
        flights: true,
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
      },
    });

    return { ok: true as const, status: 201, data: { ...created, flights: sortFlights(created.flights) } };
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { ok: false as const, status: 409, message: "reservationCode já existe" };
    }
    throw err;
  }
}

export async function updateVoucher(input: UpdateVoucherInput) {
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

  const existing = await prisma.voucher.findFirst({
    where: { id, agencyId },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false as const, status: 404, message: "Voucher nÃ£o encontrado" };
  }

  const normalized = normalizeVoucherPayload(input);
  if (!normalized.ok) {
    return normalized;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.voucher.update({
        where: { id },
        data: {
          reservationCode: normalized.data.reservationCode,
          webCheckinCode: normalized.data.webCheckinCode,
          clientName: normalized.data.clientName,
        },
      });

      await tx.flight.deleteMany({ where: { voucherId: id } });

      await tx.flight.createMany({
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

      if (normalized.data.hotel) {
        await tx.hotel.upsert({
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
            checkInTime: normalized.data.hotel.checkInTime,
            checkOutTime: normalized.data.hotel.checkOutTime,
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
            checkInTime: normalized.data.hotel.checkInTime,
            checkOutTime: normalized.data.hotel.checkOutTime,
          },
        });
      } else {
        await tx.hotel.deleteMany({ where: { voucherId: id } });
      }

      if (normalized.data.transfer) {
        await tx.transfer.upsert({
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
        await tx.transfer.deleteMany({ where: { voucherId: id } });
      }
    });

    const updated = await prisma.voucher.findFirst({
      where: { id, agencyId },
      include: { flights: true, hotel: true, transfer: true },
    });

    if (!updated) {
      return { ok: false as const, status: 404, message: "Voucher nÃ£o encontrado" };
    }

    return { ok: true as const, data: { ...updated, flights: sortFlights(updated.flights) } };
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { ok: false as const, status: 409, message: "reservationCode jÃ¡ existe" };
    }
    throw err;
  }
}

export async function listVouchers(agencyId: string) {
  if (!agencyId) {
    return {
      ok: false as const,
      status: 400,
      message: "Seu usuário não possui agencyId vinculado. Contate o suporte.",
    };
  }

  const vouchers = await prisma.voucher.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
  });

  return { ok: true as const, data: vouchers };
}

export async function getVoucherById(agencyId: string, id: string) {
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

  const voucher = await prisma.voucher.findFirst({
    where: { id, agencyId },
    include: { flights: true, hotel: true, transfer: true },
  });

  if (!voucher) {
    return { ok: false as const, status: 404, message: "Voucher não encontrado" };
  }

  return { ok: true as const, data: { ...voucher, flights: sortFlights(voucher.flights) } };
}

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
    } catch {
      return { ok: false as const, status: 502, message: "Falha ao consultar CEP externo." };
    }

    return { ok: false as const, status: 502, message: "Falha ao consultar CEP." };
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.zippopotam.us/${encodeURIComponent(countryCode)}/${encodeURIComponent(postalCodeRaw)}`
    );
  } catch {
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

