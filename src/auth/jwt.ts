import jwt, {
  JwtPayload,
  Secret,
  SignOptions,
} from "jsonwebtoken";

/**
 * 🔐 Estrutura do payload do nosso token
 */
export type UserRole = "SUPERADMIN" | "ADMIN" | "AGENCY";

export type AppJwtPayload = JwtPayload & {
  userId: string;
  agencyId?: string | null;
  role: UserRole;
};

/**
 * 🔑 Retorna o segredo do JWT validado
 */
function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não definido no .env");
  }

  return secret as Secret;
}

/**
 * ✍️ Gera token JWT
 */
export function signJwt(
  payload: Omit<AppJwtPayload, "iat" | "exp">,
  expiresIn: SignOptions["expiresIn"] = "7d"
): string {
  const options: SignOptions = { expiresIn };

  return jwt.sign(
    payload as object,
    getJwtSecret(),
    options
  );
}

/**
 * 🔎 Valida e decodifica token
 */
export function verifyJwt(token: string): AppJwtPayload {
  const decoded = jwt.verify(
    token,
    getJwtSecret()
  );

  if (typeof decoded === "string") {
    throw new Error("Token inválido (payload string)");
  }

  return decoded as AppJwtPayload;
}
