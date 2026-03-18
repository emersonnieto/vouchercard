export type SignupEmailOwner = {
  role?: unknown;
  agency?: {
    isActive?: unknown;
  } | null;
};

export const SIGNUP_EMAIL_RESERVED_MESSAGE =
  "Este email esta reservado e nao pode ser usado no cadastro.";
export const SIGNUP_EMAIL_IN_USE_MESSAGE =
  "Ja existe um acesso ao painel com este email.";

// Public signup can reuse an inactive draft account, but never an email that
// already owns an active panel login.
export function resolveSignupEmailPolicy(
  existingUser: SignupEmailOwner | null | undefined
) {
  if (!existingUser) {
    return { status: "available" as const };
  }

  const normalizedRole = String(existingUser.role ?? "").trim().toUpperCase();

  if (normalizedRole === "SUPERADMIN") {
    return {
      status: "reserved" as const,
      message: SIGNUP_EMAIL_RESERVED_MESSAGE,
    };
  }

  if (existingUser.agency?.isActive === true) {
    return {
      status: "in_use" as const,
      message: SIGNUP_EMAIL_IN_USE_MESSAGE,
    };
  }

  return { status: "reusable" as const };
}
