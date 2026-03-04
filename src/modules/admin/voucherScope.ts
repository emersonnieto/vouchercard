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
