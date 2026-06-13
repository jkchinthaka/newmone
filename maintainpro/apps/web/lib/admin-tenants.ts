export type AdminTenantOverviewRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export const ADMIN_TENANT_TABLE_FIELDS = [
  "name",
  "slug",
  "isActive",
  "memberCount",
  "createdAt",
  "updatedAt"
] as const;

export const ADMIN_TENANT_SENSITIVE_FIELDS = [
  "databaseUrl",
  "connectionString",
  "apiKey",
  "secret",
  "token",
  "password",
  "passwordHash",
  "refreshToken",
  "resetToken",
  "sessionToken",
  "stripeCustomerId",
  "stripeSecret",
  "smtpPassword",
  "smtpUser",
  "env",
  "environment",
  "subscription",
  "billingSecret",
  "invitationToken"
] as const;

export function adminTenantOverviewUsesSensitiveFields(): boolean {
  return ADMIN_TENANT_TABLE_FIELDS.some((field) =>
    (ADMIN_TENANT_SENSITIVE_FIELDS as readonly string[]).includes(field)
  );
}

export function formatAdminTenantStatus(isActive: boolean): string {
  return isActive ? "Active" : "Inactive";
}
