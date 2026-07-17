import { SetMetadata } from "@nestjs/common";

/** Explicit tenant-scoped route (default for authenticated business APIs). */
export const TENANT_SCOPED_KEY = "tenantScoped";
export const TenantScoped = () => SetMetadata(TENANT_SCOPED_KEY, true);

/**
 * Platform administration route. Restricted to SUPER_ADMIN.
 * Tenant header is optional; absence must not grant silent cross-tenant reads in services.
 */
export const PLATFORM_SCOPED_KEY = "platformScoped";
export const PlatformScoped = () => SetMetadata(PLATFORM_SCOPED_KEY, true);