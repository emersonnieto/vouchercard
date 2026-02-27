import bcrypt from "bcrypt";
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
  clientName?: unknown;
  flights?: unknown;
  hotel?: unknown;
  transfer?: unknown;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "SUPERADMIN" || value === "ADMIN";
}

const flightOrder: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
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
  const { agencyId, reservationCode, clientName, flights, hotel, transfer } = input;
  const hotelInput = (hotel ?? null) as
    | {
        hotelName?: unknown;
        mealPlan?: unknown;
        roomType?: unknown;
        checkInTime?: unknown;
        checkOutTime?: unknown;
      }
    | null;
  const transferInput = (transfer ?? null) as { receptiveName?: unknown } | null;
  const flightInputs = (Array.isArray(flights) ? flights : []) as Array<{
    direction?: unknown;
    flightNumber?: unknown;
    departureTime?: unknown;
    arrivalTime?: unknown;
    embarkAirport?: unknown;
    disembarkAirport?: unknown;
    connections?: unknown;
  }>;

  if (!agencyId) {
    return {
      ok: false as const,
      status: 400,
      message: "Seu usuário não possui agencyId vinculado. Contate o suporte.",
    };
  }
  if (!reservationCode || typeof reservationCode !== "string") {
    return { ok: false as const, status: 400, message: "reservationCode é obrigatório" };
  }
  if (!clientName || typeof clientName !== "string") {
    return { ok: false as const, status: 400, message: "clientName é obrigatório" };
  }
  if (!Array.isArray(flights) || flights.length < 1) {
    return { ok: false as const, status: 400, message: "flights é obrigatório" };
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
      flightNumber?: unknown;
      connectionAirport?: unknown;
      departureTime?: unknown;
      arrivalTime?: unknown;
    }>;

    const connections = connectionInputs
      .map((connectionInput) => ({
        flightNumber: asOptionalString(connectionInput.flightNumber),
        connectionAirport: asOptionalString(connectionInput.connectionAirport),
        departureTime: asOptionalString(connectionInput.departureTime),
        arrivalTime: asOptionalString(connectionInput.arrivalTime),
      }))
      .filter(
        (connection) =>
          !!connection.connectionAirport ||
          !!connection.flightNumber ||
          !!connection.departureTime ||
          !!connection.arrivalTime
      );

    const rows = [
      {
        direction,
        segmentOrder: 0,
        flightNumber: asOptionalString(flightInput.flightNumber),
        departureTime: asOptionalString(flightInput.departureTime),
        arrivalTime: asOptionalString(flightInput.arrivalTime),
        embarkAirport: asOptionalString(flightInput.embarkAirport),
        disembarkAirport: connections[0]?.connectionAirport ?? finalDisembarkAirport,
      },
    ];

    connections.forEach((connection, index) => {
      rows.push({
        direction,
        segmentOrder: index + 1,
        flightNumber: connection.flightNumber,
        departureTime: connection.departureTime,
        arrivalTime: connection.arrivalTime,
        embarkAirport: connection.connectionAirport,
        disembarkAirport:
          connections[index + 1]?.connectionAirport ?? finalDisembarkAirport,
      });
    });

    return rows;
  });

  try {
    const created = await prisma.voucher.create({
      data: {
        agencyId,
        reservationCode: reservationCode.trim(),
        clientName: clientName.trim(),
        flights: {
          create: flightsExpanded.map((flight) => ({
            direction: flight.direction,
            segmentOrder: flight.segmentOrder,
            flightNumber: flight.flightNumber,
            departureTime: flight.departureTime,
            arrivalTime: flight.arrivalTime,
            embarkAirport: flight.embarkAirport,
            disembarkAirport: flight.disembarkAirport,
          })),
        },
        hotel: hotelInput
          ? {
              create: {
                hotelName: hotelInput.hotelName?.toString() ?? "",
                mealPlan: hotelInput.mealPlan?.toString(),
                roomType: hotelInput.roomType?.toString(),
                checkInTime: hotelInput.checkInTime?.toString(),
                checkOutTime: hotelInput.checkOutTime?.toString(),
              },
            }
          : undefined,
        transfer: transferInput
          ? { create: { receptiveName: transferInput.receptiveName?.toString() } }
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
