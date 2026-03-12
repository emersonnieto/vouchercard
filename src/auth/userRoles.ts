import { UserRole } from "./jwt";

const LOGIN_ALLOWED_ROLES: UserRole[] = ["SUPERADMIN", "ADMIN", "AGENCY"];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function readSuperadminEmailAllowlist(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean)
  );
}

export function resolveLoginUserRole(input: {
  dbRole: unknown;
  email: string;
  allowedSuperadminEmails: ReadonlySet<string>;
}): UserRole {
  const normalizedRole = String(input.dbRole ?? "").trim().toUpperCase();

  if (!LOGIN_ALLOWED_ROLES.includes(normalizedRole as UserRole)) {
    return "ADMIN";
  }

  if (normalizedRole !== "SUPERADMIN") {
    return normalizedRole as UserRole;
  }

  return input.allowedSuperadminEmails.has(normalizeEmail(input.email))
    ? "SUPERADMIN"
    : "ADMIN";
}

export function resolveAgencyUserRole(role: unknown) {
  return role === undefined || role === null || role === "" || role === "ADMIN"
    ? { ok: true as const, role: "ADMIN" as const }
    : {
        ok: false as const,
        message:
          "Criacao de usuario por agencia aceita apenas o papel ADMIN. SUPERADMIN deve ser provisionado manualmente.",
      };
}
