import { Router, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";

export const adminRouter = Router();

type UserRole = "SUPERADMIN" | "ADMIN";

function isUserRole(value: unknown): value is UserRole {
  return value === "SUPERADMIN" || value === "ADMIN";
}

const flightOrder: Record<string, number> = { OUTBOUND: 0, RETURN: 1 };
function sortFlights<T extends { direction: string }>(flights: T[]) {
  return [...flights].sort(
    (a, b) => (flightOrder[a.direction] ?? 99) - (flightOrder[b.direction] ?? 99)
  );
}

/**
 * 🔒 Me (dados do usuário logado + agência)
 * GET /admin/me
 */
adminRouter.get("/me", async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ message: "Não autorizado" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, agencyId: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

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
          },
        })
      : null;

    return res.json({ user, agency });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * 🔒 Listar agências (somente SUPERADMIN)
 * GET /admin/agencies
 */
adminRouter.get("/agencies", requireRole(["SUPERADMIN"]), async (req: AuthedRequest, res: Response) => {
  try {
    const agencies = await prisma.agency.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, slug: true, email: true, phone: true, createdAt: true },
    });

    return res.json(agencies);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * 🔒 Criar nova agência (SUPERADMIN)
 * POST /admin/agencies
 */
adminRouter.post("/agencies", requireRole(["SUPERADMIN"]), async (req: AuthedRequest, res: Response) => {
  try {
    const { name, slug, phone, email } = (req.body ?? {}) as {
      name?: unknown;
      slug?: unknown;
      phone?: unknown;
      email?: unknown;
    };

    if (!name || typeof name !== "string") return res.status(400).json({ message: "name é obrigatório" });
    if (!slug || typeof slug !== "string") return res.status(400).json({ message: "slug é obrigatório" });

    const agency = await prisma.agency.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        phone: phone ? String(phone) : null,
        email: email ? String(email) : null,
      },
      select: { id: true, name: true, slug: true, phone: true, email: true, createdAt: true },
    });

    return res.status(201).json(agency);
  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2002") return res.status(409).json({ message: "Slug já existe" });
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * 🔒 SUPERADMIN cria o primeiro usuário de uma agência
 * POST /admin/agencies/:agencyId/users
 */
adminRouter.post(
  "/agencies/:agencyId/users",
  requireRole(["SUPERADMIN"]),
  async (req: AuthedRequest, res: Response) => {
    try {
      const agencyId = String(req.params.agencyId || "").trim();
      const { name, email, password, role } = (req.body ?? {}) as {
        name?: unknown;
        email?: unknown;
        password?: unknown;
        role?: unknown;
      };

      if (!agencyId) return res.status(400).json({ message: "agencyId inválido" });
      if (!name || typeof name !== "string") return res.status(400).json({ message: "name é obrigatório" });
      if (!email || typeof email !== "string") return res.status(400).json({ message: "email é obrigatório" });
      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "password é obrigatório (mín 6)" });
      }

      const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { id: true } });
      if (!agency) return res.status(404).json({ message: "Agência não encontrada" });

      const passwordHash = await bcrypt.hash(password, 10);
      const finalRole: UserRole = isUserRole(role) ? role : "ADMIN";

      const user = await prisma.user.create({
        data: {
          agencyId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash,
          role: finalRole,
        },
        select: { id: true, agencyId: true, name: true, email: true, role: true, createdAt: true },
      });

      return res.status(201).json(user);
    } catch (err: any) {
      console.error(err);
      if (err?.code === "P2002") return res.status(409).json({ message: "Email já existe" });
      return res.status(500).json({ message: "Erro interno" });
    }
  }
);

/**
 * 🔒 Criar voucher (ADMIN e SUPERADMIN)
 * POST /admin/vouchers
 */
adminRouter.post("/vouchers", requireRole(["ADMIN", "SUPERADMIN"]), async (req: AuthedRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId ? String(req.user.agencyId) : "";
    if (!agencyId) {
      return res.status(400).json({
        message: "Seu usuário não possui agencyId vinculado. Contate o suporte.",
      });
    }

    const { reservationCode, clientName, flights, hotel, transfer } = (req.body ?? {}) as any;

    if (!reservationCode || typeof reservationCode !== "string") {
      return res.status(400).json({ message: "reservationCode é obrigatório" });
    }
    if (!clientName || typeof clientName !== "string") {
      return res.status(400).json({ message: "clientName é obrigatório" });
    }
    if (!Array.isArray(flights) || flights.length < 1) {
      return res.status(400).json({ message: "flights é obrigatório" });
    }

    const hasOutbound = flights.some((f: any) => f?.direction === "OUTBOUND");
    const hasReturn = flights.some((f: any) => f?.direction === "RETURN");
    if (!hasOutbound || !hasReturn) {
      return res.status(400).json({ message: "Inclua flights com direction OUTBOUND e RETURN" });
    }

    const created = await prisma.voucher.create({
      data: {
        agencyId,
        reservationCode: reservationCode.trim(),
        clientName: clientName.trim(),
        flights: {
          create: flights.map((f: any) => ({
            direction: f.direction,
            flightNumber: f.flightNumber?.toString(),
            departureTime: f.departureTime?.toString(),
            arrivalTime: f.arrivalTime?.toString(),
            embarkAirport: f.embarkAirport?.toString(),
            disembarkAirport: f.disembarkAirport?.toString(),
          })),
        },
        hotel: hotel
          ? {
              create: {
                hotelName: hotel.hotelName?.toString() ?? "",
                mealPlan: hotel.mealPlan?.toString(),
                roomType: hotel.roomType?.toString(),
                checkInTime: hotel.checkInTime?.toString(),
                checkOutTime: hotel.checkOutTime?.toString(),
              },
            }
          : undefined,
        transfer: transfer
          ? { create: { receptiveName: transfer.receptiveName?.toString() } }
          : undefined,
      },
      include: {
        flights: true,
        hotel: true,
        transfer: true,
        agency: { select: { id: true, name: true, slug: true, phone: true, email: true } }, // ✅ útil
      },
    });

    return res.status(201).json({ ...created, flights: sortFlights(created.flights) });
  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2002") return res.status(409).json({ message: "reservationCode já existe" });
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * 🔒 Listar vouchers da própria agência
 * GET /admin/vouchers
 */
adminRouter.get("/vouchers", requireRole(["ADMIN", "SUPERADMIN"]), async (req: AuthedRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId ? String(req.user.agencyId) : "";
    if (!agencyId) {
      return res.status(400).json({ message: "Seu usuário não possui agencyId vinculado. Contate o suporte." });
    }

    const vouchers = await prisma.voucher.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
    });

    return res.json(vouchers);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
});

/**
 * 🔒 Detalhe de um voucher da própria agência
 * GET /admin/vouchers/:id
 */
adminRouter.get("/vouchers/:id", requireRole(["ADMIN", "SUPERADMIN"]), async (req: AuthedRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId ? String(req.user.agencyId) : "";
    const id = String(req.params.id || "").trim();

    if (!agencyId) return res.status(400).json({ message: "Seu usuário não possui agencyId vinculado." });
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const voucher = await prisma.voucher.findFirst({
      where: { id, agencyId },
      include: { flights: true, hotel: true, transfer: true },
    });

    if (!voucher) return res.status(404).json({ message: "Voucher não encontrado" });

    return res.json({ ...voucher, flights: sortFlights(voucher.flights) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
});