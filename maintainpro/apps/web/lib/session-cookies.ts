import { cookies } from "next/headers";

export const ACCESS_COOKIE = "maintainpro_access";
export const REFRESH_COOKIE = "maintainpro_refresh";
export const CSRF_COOKIE = "maintainpro_csrf";
export const CSRF_HEADER = "x-csrf-token";

const isProd = process.env.NODE_ENV === "production";

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds
  };
}

export function csrfCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: false as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds
  };
}

export async function readSessionCookies() {
  const jar = await cookies();
  return {
    accessToken: jar.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: jar.get(REFRESH_COOKIE)?.value ?? null,
    csrfToken: jar.get(CSRF_COOKIE)?.value ?? null
  };
}