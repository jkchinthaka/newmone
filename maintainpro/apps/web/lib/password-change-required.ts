/**
 * Accounts issued a temporary password must replace it before using the app. The API
 * answers every other route with 403 { code: "PASSWORD_CHANGE_REQUIRED" }.
 */
export const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";
export const PASSWORD_CHANGE_PATH = "/settings?tab=security";

export function isPasswordChangeRequiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const response = (error as { response?: { status?: number; data?: { error?: { code?: unknown } } } }).response;
  return (
    response?.status === 403 &&
    String(response.data?.error?.code ?? "").toUpperCase() === PASSWORD_CHANGE_REQUIRED_CODE
  );
}

export function userMustChangePassword(user: unknown): boolean {
  return Boolean(user && typeof user === "object" && (user as { mustChangePassword?: unknown }).mustChangePassword === true);
}

/** Post-login landing: the password screen comes first when a change is pending. */
export function postLoginDestination(user: unknown, destination: string): string {
  return userMustChangePassword(user) ? PASSWORD_CHANGE_PATH : destination;
}

/** True when the browser is already on the password screen (avoid redirect loops). */
export function isOnPasswordChangeScreen(pathname: string, search: string): boolean {
  if (pathname !== "/settings") return false;
  return new URLSearchParams(search).get("tab") === "security";
}

/** Same rule as the API (PASSWORD_STRENGTH_PATTERN): 8+ chars, uppercase, number, symbol. */
export function passwordStrengthError(next: string): string | null {
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(next)) {
    return "Use at least 8 characters with an uppercase letter, a number and a symbol.";
  }
  return null;
}
