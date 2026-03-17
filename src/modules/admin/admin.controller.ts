import { Response } from "express";
import { RlsDbClient, runWithRlsContext } from "../../lib/rls";
import { AuthedRequest } from "../../middlewares/requireAuth";
import * as adminService from "./admin.service";
import { resolveOwnedAgencyId, resolveVoucherAgencyId } from "./voucherScope";

type ServiceResult<T = unknown> =
  | { ok: true; status?: number; data: T }
  | { ok: false; status: number; message: string };

function reply<T>(res: Response, result: ServiceResult<T>) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.message });
  }
  return res.status(result.status ?? 200).json(result.data);
}

async function runAdminDb<T>(
  req: AuthedRequest,
  callback: (db: RlsDbClient) => Promise<T>
) {
  if (!req.user) {
    throw new Error("Nao autorizado");
  }

  return runWithRlsContext(req.user, callback);
}

export async function getMe(req: AuthedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Nao autorizado" });

    const result = await runAdminDb(req, (db) =>
      adminService.getMe(userId, db)
    );
    if (!result) return res.status(404).json({ message: "Usuario nao encontrado" });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function getAgencySubscription(req: AuthedRequest, res: Response) {
  try {
    const agencyId = String(req.user?.agencyId ?? "").trim();

    const result = await runAdminDb(req, (db) =>
      adminService.getAgencySubscription(agencyId, db)
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function cancelAgencySubscription(req: AuthedRequest, res: Response) {
  try {
    const agencyId = String(req.user?.agencyId ?? "").trim();

    const result = await runAdminDb(req, (db) =>
      adminService.cancelAgencySubscriptionAtPeriodEnd(agencyId, db)
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function listAgencies(req: AuthedRequest, res: Response) {
  try {
    const agencies = await runAdminDb(req, (db) =>
      adminService.listAgencies(db)
    );
    return res.json(agencies);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function createAgency(req: AuthedRequest, res: Response) {
  try {
    const result = await runAdminDb(req, (db) =>
      adminService.createAgency(req.body ?? {}, db)
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function updateAgencyStatus(req: AuthedRequest, res: Response) {
  try {
    const result = await runAdminDb(req, (db) =>
      adminService.updateAgencyStatus(
        {
          agencyId: String(req.params.agencyId || "").trim(),
          isActive: (req.body ?? {}).isActive,
        },
        db
      )
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function updateAgencyBranding(req: AuthedRequest, res: Response) {
  try {
    const scope = resolveOwnedAgencyId(req, req.params.agencyId);
    if (!scope.ok) {
      return res.status(scope.status).json({ message: scope.message });
    }

    const result = await runAdminDb(req, (db) =>
      adminService.updateAgencyBranding(
        {
          agencyId: scope.agencyId,
          logoUrl: (req.body ?? {}).logoUrl,
          primaryColor: (req.body ?? {}).primaryColor,
        },
        db
      )
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function uploadAgencyLogo(req: AuthedRequest, res: Response) {
  try {
    const body = req.body ?? {};
    const scope = resolveOwnedAgencyId(req, req.params.agencyId);
    if (!scope.ok) {
      return res.status(scope.status).json({ message: scope.message });
    }

    const result = await runAdminDb(req, (db) =>
      adminService.uploadAgencyLogo(
        {
          agencyId: scope.agencyId,
          fileName: body.fileName,
          contentType: body.contentType,
          dataBase64: body.dataBase64,
        },
        db
      )
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function createAgencyUser(req: AuthedRequest, res: Response) {
  try {
    const body = req.body ?? {};
    const result = await runAdminDb(req, (db) =>
      adminService.createAgencyUser(
        {
          agencyId: String(req.params.agencyId || "").trim(),
          name: body.name,
          email: body.email,
          password: body.password,
          role: body.role,
        },
        db
      )
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function createVoucher(req: AuthedRequest, res: Response) {
  try {
    const body = req.body ?? {};
    const result = await runAdminDb(req, (db) =>
      adminService.createVoucher(
        {
          agencyId: resolveVoucherAgencyId(req, body.agencyId),
          reservationCode: body.reservationCode,
          webCheckinCode: body.webCheckinCode,
          clientName: body.clientName,
          tripDestination: body.tripDestination,
          insuranceProvider: body.insuranceProvider,
          insurancePhone: body.insurancePhone,
          insuranceEmail: body.insuranceEmail,
          additionalNotes: body.additionalNotes,
          tours: body.tours,
          flights: body.flights,
          hotel: body.hotel,
          transfer: body.transfer,
        },
        db
      )
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function listVouchers(req: AuthedRequest, res: Response) {
  try {
    const result = await runAdminDb(req, (db) =>
      adminService.listVouchers(
        resolveVoucherAgencyId(req, req.query.agencyId),
        db
      )
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function getVoucherById(req: AuthedRequest, res: Response) {
  try {
    const result = await runAdminDb(req, (db) =>
      adminService.getVoucherById(
        resolveVoucherAgencyId(req, req.query.agencyId),
        String(req.params.id || "").trim(),
        db
      )
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function updateVoucher(req: AuthedRequest, res: Response) {
  try {
    const body = req.body ?? {};
    const result = await runAdminDb(req, (db) =>
      adminService.updateVoucher(
        {
          agencyId: resolveVoucherAgencyId(req, body.agencyId),
          id: String(req.params.id || "").trim(),
          reservationCode: body.reservationCode,
          webCheckinCode: body.webCheckinCode,
          clientName: body.clientName,
          tripDestination: body.tripDestination,
          insuranceProvider: body.insuranceProvider,
          insurancePhone: body.insurancePhone,
          insuranceEmail: body.insuranceEmail,
          additionalNotes: body.additionalNotes,
          tours: body.tours,
          flights: body.flights,
          hotel: body.hotel,
          transfer: body.transfer,
        },
        db
      )
    );
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function lookupPostalCode(req: AuthedRequest, res: Response) {
  try {
    const result = await adminService.lookupPostalCode({
      countryCode: req.query.countryCode,
      postalCode: req.query.postalCode,
    });
    return reply(res, result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno" });
  }
}
