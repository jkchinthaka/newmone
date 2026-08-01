/**
 * Canonical successful-logout HTTP status for NestJS POST /auth/logout.
 * Logout returns a JSON confirmation body; it does not create a REST resource.
 * Do not rely on NestJS POST default (201 Created). Prefer 200 over 204 because
 * a response body is documented.
 */
export const AUTH_LOGOUT_SUCCESS_HTTP_STATUS = 200 as const;