export interface SwaggerSetupOptions {
  isProd: boolean;
  swaggerEnabled: boolean;
  swaggerUser?: string;
  swaggerPassword?: string;
}

/**
 * Swagger is always available outside production. In production it is opt-in via
 * SWAGGER_ENABLED=true and requires both SWAGGER_USER/SWAGGER_PASSWORD to be set
 * so the docs route can be protected with HTTP Basic Auth.
 */
export function shouldSetupSwagger(options: SwaggerSetupOptions): boolean {
  const { isProd, swaggerEnabled, swaggerUser, swaggerPassword } = options;
  return !isProd || (swaggerEnabled && !!swaggerUser && !!swaggerPassword);
}

export function shouldProtectSwaggerWithBasicAuth(options: SwaggerSetupOptions): boolean {
  return options.isProd && !!options.swaggerUser && !!options.swaggerPassword;
}

export function verifySwaggerBasicAuth(
  authHeader: string | string[] | undefined,
  expectedUser: string,
  expectedPassword: string
): boolean {
  const encoded =
    typeof authHeader === "string" && authHeader.startsWith("Basic ")
      ? authHeader.slice("Basic ".length)
      : undefined;
  if (!encoded) return false;

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : "";
  const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

  return user === expectedUser && password === expectedPassword;
}
