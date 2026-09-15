/**
 * Phase 15 — MongoDB → SQL Server data migration entrypoint.
 *
 * Delegates to the hardened pipeline under scripts/mongo-to-sqlserver/.
 * DRY-RUN by default. Pass --apply to write to SQL Server.
 *
 * Usage (from maintainpro/):
 *   MONGO_URL=... DATABASE_URL=sqlserver://... npx tsx scripts/migrate-mongo-to-sqlserver.ts
 *   ... --apply
 */
import "./mongo-to-sqlserver/migrate";
