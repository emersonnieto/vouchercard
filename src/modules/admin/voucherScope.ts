import { AuthedRequest } from "../../middlewares/requireAuth";

function readAgencyIdValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function resolveVoucherAgencyId(
  req: Pick<AuthedRequest, "user">,
  explicitAgencyId?: unknown
) {
  const explicit = readAgencyIdValue(explicitAgencyId);

  if (req.user?.role === "SUPERADMIN") {
    return explicit || (req.user?.agencyId ? String(req.user.agencyId) : "");
  }

  return req.user?.agencyId ? String(req.user.agencyId) : "";
}

export function resolveOwnedAgencyId(
  req: Pick<AuthedRequest, "user">,
  explicitAgencyId?: unknown
) {
  const explicit = readAgencyIdValue(explicitAgencyId);

  if (req.user?.role === "SUPERADMIN") {
    return {
      ok: true as const,
      agencyId: explicit || (req.user?.agencyId ? String(req.user.agencyId) : ""),
    };
  }

  const ownAgencyId = req.user?.agencyId ? String(req.user.agencyId) : "";

  if (!ownAgencyId) {
    return {
      ok: false as const,
      status: 403,
      message: "Usuario sem agencia vinculada.",
    };
  }

  if (explicit && explicit !== ownAgencyId) {
    return {
      ok: false as const,
      status: 403,
      message: "Sem permissao para alterar outra agencia.",
    };
  }

  return {
    ok: true as const,
    agencyId: ownAgencyId,
  };
}
