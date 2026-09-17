/**
 * Microsoft Entra ID (Azure AD) SSO readiness.
 *
 * Production tenant registration / client secrets are EXTERNAL_DEPENDENCY.
 * This module provides the in-repo adapter contract and exchange stub so
 * authentication architecture is SSO-ready without inventing live Entra APIs.
 */

export type EntraTokenClaims = {
  oid?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  tid?: string;
};

export type EntraExchangeResult =
  | { status: "READY_FOR_CONFIG"; message: string }
  | { status: "MAPPED"; externalSubject: string; email?: string; displayName?: string };

export class EntraSsoAdapter {
  constructor(
    private readonly options: {
      tenantId?: string;
      clientId?: string;
      enabled: boolean;
    }
  ) {}

  isConfigured(): boolean {
    return !!(this.options.enabled && this.options.tenantId && this.options.clientId);
  }

  /**
   * Validates that an Entra authorization code / ID token payload shape is acceptable.
   * Does not call Microsoft endpoints without configuration.
   */
  exchangeIdTokenClaims(claims: EntraTokenClaims): EntraExchangeResult {
    if (!this.isConfigured()) {
      return {
        status: "READY_FOR_CONFIG",
        message:
          "Entra adapter is implemented. Set ENTRA_TENANT_ID, ENTRA_CLIENT_ID, and ENTRA_ENABLED=true to activate."
      };
    }
    const subject = claims.oid || claims.preferred_username || claims.email;
    if (!subject) {
      throw new Error("Entra claims missing subject (oid/email)");
    }
    return {
      status: "MAPPED",
      externalSubject: `entra:${claims.tid ?? this.options.tenantId}:${subject}`,
      email: claims.email || claims.preferred_username,
      displayName: claims.name
    };
  }
}

export function createEntraSsoAdapterFromEnv(env: NodeJS.ProcessEnv = process.env): EntraSsoAdapter {
  return new EntraSsoAdapter({
    enabled: String(env.ENTRA_ENABLED || "").toLowerCase() === "true",
    tenantId: env.ENTRA_TENANT_ID,
    clientId: env.ENTRA_CLIENT_ID
  });
}
