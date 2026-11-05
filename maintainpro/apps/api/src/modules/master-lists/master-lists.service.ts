import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";

export const LIST_KINDS = ["unit", "skill", "make"] as const;
export type ListKind = (typeof LIST_KINDS)[number];
const DB_KIND: Record<ListKind, string> = { unit: "UNIT", skill: "SKILL", make: "MAKE" };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Simple master pick-lists (units, skills, makes) and the work calendar (holidays, shifts). */
@Injectable()
export class MasterListsService {
  constructor(private readonly prisma: PrismaService) {}

  private kind(raw: string): string {
    if (!(LIST_KINDS as readonly string[]).includes(raw)) throw new NotFoundException("Unknown list.");
    return DB_KIND[raw as ListKind];
  }

  list(tenantIdRaw: string | null, rawKind: string, includeInactive = false) {
    const tenantId = requireTenantId(tenantIdRaw);
    return this.prisma.masterListItem.findMany({
      where: { tenantId, kind: this.kind(rawKind), ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" }
    });
  }

  async create(tenantIdRaw: string | null, rawKind: string, input: { name: string; code?: string | null }) {
    const tenantId = requireTenantId(tenantIdRaw);
    const kind = this.kind(rawKind);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Enter a name.");
    const code = input.code?.trim().slice(0, 40) || null;
    const existing = await this.prisma.masterListItem.findFirst({ where: { tenantId, kind, name } });
    if (existing) {
      if (existing.isActive) throw new BadRequestException(`"${name}" is already in the list.`);
      return this.prisma.masterListItem.update({ where: { id: existing.id }, data: { isActive: true, code } });
    }
    return this.prisma.masterListItem.create({ data: { tenantId, kind, name: name.slice(0, 200), code } });
  }

  async update(tenantIdRaw: string | null, rawKind: string, id: string, input: { name?: string; code?: string | null; isActive?: boolean }) {
    const tenantId = requireTenantId(tenantIdRaw);
    const kind = this.kind(rawKind);
    const row = await this.prisma.masterListItem.findFirst({ where: { id, tenantId, kind } });
    if (!row) throw new NotFoundException("Item not found.");
    const name = input.name?.trim();
    if (input.name !== undefined && !name) throw new BadRequestException("Enter a name.");
    if (name && name !== row.name && (await this.prisma.masterListItem.findFirst({ where: { tenantId, kind, name } }))) {
      throw new BadRequestException(`"${name}" is already in the list.`);
    }
    return this.prisma.masterListItem.update({
      where: { id },
      data: {
        ...(name ? { name: name.slice(0, 200) } : {}),
        ...(input.code !== undefined ? { code: input.code?.trim().slice(0, 40) || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });
  }

  calendar(tenantIdRaw: string | null) {
    const tenantId = requireTenantId(tenantIdRaw);
    return this.prisma.workCalendarEntry.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ kind: "asc" }, { date: "asc" }, { startTime: "asc" }]
    });
  }

  async createCalendar(tenantIdRaw: string | null, input: { kind: string; name: string; date?: string; startTime?: string; endTime?: string }) {
    const tenantId = requireTenantId(tenantIdRaw);
    const kind = input.kind === "SHIFT" ? "SHIFT" : input.kind === "HOLIDAY" ? "HOLIDAY" : null;
    if (!kind) throw new BadRequestException("Choose holiday or shift.");
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Enter a name.");
    if (kind === "HOLIDAY") {
      const date = input.date ? new Date(`${input.date}T00:00:00.000Z`) : null;
      if (!date || Number.isNaN(date.getTime())) throw new BadRequestException("Pick a date.");
      return this.prisma.workCalendarEntry.create({ data: { tenantId, kind, name: name.slice(0, 200), date } });
    }
    if (!TIME.test(input.startTime ?? "") || !TIME.test(input.endTime ?? "")) throw new BadRequestException("Enter start and end time as HH:mm.");
    return this.prisma.workCalendarEntry.create({
      data: { tenantId, kind, name: name.slice(0, 200), startTime: input.startTime, endTime: input.endTime }
    });
  }

  async removeCalendar(tenantIdRaw: string | null, id: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    const row = await this.prisma.workCalendarEntry.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Entry not found.");
    return this.prisma.workCalendarEntry.update({ where: { id }, data: { isActive: false } });
  }
}
