import { Response } from "express";
import { AuthedRequest } from "../../middlewares/requireAuth";
import * as adminService from "./admin.service";

type ServiceResult<T = unknown> =
  | { ok: true; status?: number; data: T }
  | { ok: false; status: number; message: string };

function reply<T>(res: Response, result: ServiceResult<T>) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.message });
  }
  return res.status(result.status ?? 200).json(result.data);
}

export async function getMe(req: AuthedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Não autorizado" });

    const result = await adminService.getMe(userId);
    if (!result) return res.status(404).json({ message: "Usuário não encontrado" });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function listAgencies(_req: AuthedRequest, res: Response) {
  try {
    const agencies = await adminService.listAgencies();
    return res.json(agencies);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function createAgency(req: AuthedRequest, res: Response) {
  try {
    const result = await adminService.createAgency(req.body ?? {});
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function updateAgencyStatus(req: AuthedRequest, res: Response) {
  try {
    const result = await adminService.updateAgencyStatus({
      agencyId: String(req.params.agencyId || "").trim(),
      isActive: (req.body ?? {}).isActive,
    });
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function updateAgencyBranding(req: AuthedRequest, res: Response) {
  try {
    const result = await adminService.updateAgencyBranding({
      agencyId: String(req.params.agencyId || "").trim(),
      logoUrl: (req.body ?? {}).logoUrl,
      primaryColor: (req.body ?? {}).primaryColor,
    });
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function createAgencyUser(req: AuthedRequest, res: Response) {
  try {
    const body = req.body ?? {};
    const result = await adminService.createAgencyUser({
      agencyId: String(req.params.agencyId || "").trim(),
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
    });
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function createVoucher(req: AuthedRequest, res: Response) {
  try {
    const body = req.body ?? {};
    const result = await adminService.createVoucher({
      agencyId: req.user?.agencyId ? String(req.user.agencyId) : "",
      reservationCode: body.reservationCode,
      clientName: body.clientName,
      flights: body.flights,
      hotel: body.hotel,
      transfer: body.transfer,
    });
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function listVouchers(req: AuthedRequest, res: Response) {
  try {
    const result = await adminService.listVouchers(
      req.user?.agencyId ? String(req.user.agencyId) : ""
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function getVoucherById(req: AuthedRequest, res: Response) {
  try {
    const result = await adminService.getVoucherById(
      req.user?.agencyId ? String(req.user.agencyId) : "",
      String(req.params.id || "").trim()
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}
