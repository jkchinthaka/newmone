/**
 * Canonical successful-login HTTP status for NestJS POST /auth/login.
 * Login authenticates credentials and returns a session token payload;
 * it does not create a durable REST resource, so 200 OK is intentional.
 * Do not rely on NestJS POST default (201 Created).
 */
export const AUTH_LOGIN_SUCCESS_HTTP_STATUS = 200 as const;

export const AUTH_LOGIN_SUCCESS_HTTP_STATUS_NAME = 'OK' as const;