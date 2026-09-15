/**
 * Phase 15 — SQL Server Prisma client gaps (enum filters removed; JSON text fields).
 */
import "@prisma/client";

declare module "@prisma/client" {
  namespace Prisma {
    type EnumStringFilter = {
      equals?: string | null;
      in?: string[];
      notIn?: string[];
      not?: string | EnumStringFilter | null;
    };

    type EnumPriorityFilter = EnumStringFilter;
    type EnumWorkOrderTypeFilter = EnumStringFilter;
    type EnumQaIssuePriorityFilter = EnumStringFilter;
    type EnumWorkOrderStatusFilter = EnumStringFilter;
    type EnumRoleNameFilter = EnumStringFilter;
  }
}
