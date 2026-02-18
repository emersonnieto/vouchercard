import { Router, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";

export const adminRouter = Router();

/**
 * 🔒 Criar nova agência
 * Somente SUPERADMIN pode criar agência
 * POST /admin/agencies
 * body: { name: string, slug: string, phone?: string, email?: string }
 */
adminRouter.post(
  "/agencies",
  requireRole(["SUPERADMIN"]),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { name, slug, phone, email } = req.body ?? {};

      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "name é obrigatório" });
      }

      if (!slug || typeof slug !== "string") {
        return res.status(400).json({ message: "slug é obrigatório" });
      }

      const agency = await prisma.agency.create({
        data: {
          name: name.trim(),
          slug: slug.trim(),
          phone: phone ? String(phone) : null,
          email: email ? String(email) : null,
        },
      });

      return res.status(201).json(agency);
    } catch (err: any) {
      console.error(err);

      if (err?.code === "P2002") {
        return res.status(409).json({ message: "Slug já existe" });
      }

      return res.status(500).json({ message: "Erro interno" });
    }
  }
);

/**
 * 🔒 SUPERADMIN cria o primeiro usuário de uma agência
 * POST /admin/agencies/:agencyId/users
 * body: { name: string, email: string, password: string, role?: string }
 */
adminRouter.post(
  "/agencies/:agencyId/users",
  requireRole(["SUPERADMIN"]),
  async (req: AuthedRequest, res: Response) => {
    try {
      const agencyId = String(req.params.agencyId);
      const { name, email, password, role } = req.body ?? {};

      if (!agencyId) {
        return res.status(400).json({ message: "agencyId inválido" });
      }

      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "name é obrigatório" });
      }

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email é obrigatório" });
      }

      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "password é obrigatório (mín 6)" });
      }

      const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
      if (!agency) {
        return res.status(404).json({ message: "Agência não encontrada" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          agencyId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash,
          role: role && typeof role === "string" ? role : "ADMIN",
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

      return res.status(201).json(user);
    } catch (err: any) {
      console.error(err);

      if (err?.code === "P2002") {
        return res.status(409).json({ message: "Email já existe" });
      }

      return res.status(500).json({ message: "Erro interno" });
    }
  }
);

/**
 * 🔒 Criar voucher (AGÊNCIA/ADMIN e SUPERADMIN)
 * agencyId SEMPRE vem do token (não do body)
 * POST /admin/vouchers
 */
adminRouter.post(
  "/vouchers",
  requireRole(["ADMIN", "SUPERADMIN"]),
  async (req: AuthedRequest, res: Response) => {
    try {
      const agencyId = req.user?.agencyId;

      if (!agencyId) {
        return res.status(400).json({
          message: "Seu usuário não possui agencyId vinculado. Contate o suporte.",
        });
      }

      const { reservationCode, clientName, flights, hotel, transfer } = req.body ?? {};

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
        return res.status(400).json({
          message: "Inclua flights com direction OUTBOUND e RETURN",
        });
      }

      const created = await prisma.voucher.create({
        data: {
          agencyId: String(agencyId),
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
            ? {
                create: {
                  receptiveName: transfer.receptiveName?.toString(),
                },
              }
            : undefined,
        },
        include: { flights: true, hotel: true, transfer: true },
      });

      return res.status(201).json(created);
    } catch (err: any) {
      console.error(err);

      if (err?.code === "P2002") {
        return res.status(409).json({
          message: "reservationCode já existe para essa agência",
        });
      }

      return res.status(500).json({ message: "Erro interno" });
    }
  }
);

/**
 * 🔒 Listar vouchers da própria agência (ADMIN/SUPERADMIN)
 * GET /admin/vouchers
 */
adminRouter.get(
  "/vouchers",
  requireRole(["ADMIN", "SUPERADMIN"]),
  async (req: AuthedRequest, res: Response) => {
    try {
      const agencyId = req.user?.agencyId;

      if (!agencyId) {
        return res.status(400).json({
          message: "Seu usuário não possui agencyId vinculado. Contate o suporte.",
        });
      }

      const vouchers = await prisma.voucher.findMany({
        where: { agencyId: String(agencyId) },
        orderBy: { createdAt: "desc" },
      });

      return res.json(vouchers);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  }
);
