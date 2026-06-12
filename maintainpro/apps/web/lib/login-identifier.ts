/**
 * Login identifier helpers for the web auth form.
 *
 * Backend contract (`LoginDto`): POST /auth/login expects a valid `email` string.
 * User lookup is by `User.email` only — there is no username login path on the API.
 */

const WORK_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Suffix used only when explicit dev alias mode is enabled for local seed accounts. */
export const LOCAL_DEV_EMAIL_SUFFIX = "@maintainpro.local";

export function isDevLocalEmailAliasEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LOGIN_DEV_LOCAL_ALIAS === "true";
}

export function validateWorkEmail(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Work email is required";
  }

  const candidate = resolveLoginEmail(trimmed);

  if (!WORK_EMAIL_PATTERN.test(candidate)) {
    return "Enter a valid work email address";
  }

  return null;
}

/**
 * Returns the email value sent to POST /auth/login.
 * Production: trimmed input only (no silent alias conversion).
 * Development: optional alias when NEXT_PUBLIC_LOGIN_DEV_LOCAL_ALIAS=true and input has no @.
 */
export function resolveLoginEmail(value: string): string {
  const trimmed = value.trim();

  if (!trimmed.includes("@") && isDevLocalEmailAliasEnabled()) {
    return `${trimmed}${LOCAL_DEV_EMAIL_SUFFIX}`;
  }

  return trimmed;
}
