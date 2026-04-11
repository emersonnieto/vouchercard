import { Response } from "express";

export const AUTH_COOKIE_NAME = "vouchercard_session";
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readBooleanEnv(name: string) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return null;
  return ["1", "true", "yes", "on"].includes(raw);
}

function isAuthCookieSecure() {
  const explicit = readBooleanEnv("AUTH_COOKIE_SECURE");
  if (explicit !== null) return explicit;

  return process.env.NODE_ENV === "production" || process.env.RENDER === "true";
}

export function getAuthCookieOptions() {
  const secure = isAuthCookieSecure();

  return {
    httpOnly: true,
    secure,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...getAuthCookieOptions(),
    maxAge: undefined,
  });
}

export function readCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return "";

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawKey, ...rawValue] = cookie.split("=");
    const key = rawKey?.trim();
    if (key !== name) continue;

    const value = rawValue.join("=").trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return "";
}
