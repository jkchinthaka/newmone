import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { Phase4Actor } from "../_phase4/phase4-audit.helper";
import type { CreateStatutoryCertificateDto, RenewStatutoryCertificateDto } from "./dto/statutory.dto";
import {
  STATUTORY_SUBJECT_TYPE,
  STATUTORY_TYPES,
  daysUntil,
  isStatutoryTypeKey,
  statutoryLabel,
  statutoryState,
  summarizeStates,
  type StatutoryState
} from "./statutory-catalog";

export interface StatutoryListQuery {
  state?: StatutoryState;
  assetId?: string;
  typeKey?: string;
}

@Injectable()
export class StatutoryService {
  constructor(private readonly prisma: PrismaService) {}

  catalog() {
    return STATUTORY_TYPES;
  }

  private async rows(tenantId: string, where: { assetId?: string; typeKey?: string } = {}) {
    const items = await this.prisma.complianceRequirement.findMany({
      where: {
        tenantId,
        isActive: true,
        subjectType: STATUTORY_SUBJECT_TYPE,
        ...(where.assetId ? { subjectId: where.assetId } : {}),
        ...(where.typeKey ? { typeKey: where.typeKey } : {})
      },
      orderBy: { expiresAt: "asc" },
      take: 1000
    });
    const assetIds = [...new Set(items.map((item) => item.subjectId))];
    const assets = assetIds.length
      ? await this.prisma.asset.findMany({
          where: { tenantId, id: { in: assetIds } },
          select: { id: true, assetTag: true, name: true }
        })
      : [];
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const now = new Date();
    return items.map((item) => {
      const asset = byId.get(item.subjectId);
      const expiresAt = item.expiresAt ?? now;
      return {
        id: item.id,
        assetId: item.subjectId,
        assetTag: asset?.assetTag ?? null,
        assetName: asset?.name ?? null,
        typeKey: item.typeKey,
        typeLabel: statutoryLabel(item.typeKey),
        title: item.title,
        issuedAt: item.issuedAt,
        expiresAt: item.expiresAt,
        reminderDays: item.reminderDays,
        providerName: item.providerName,
        certificateUrl: item.certificateUrl,
        state: statutoryState(expiresAt, item.reminderDays, now),
        daysLeft: daysUntil(expiresAt, now)
      };
    });
  }

  async list(actor: Phase4Actor, query: StatutoryListQuery = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    const all = await this.rows(tenantId, query);
    return query.state ? all.filter((row) => row.state === query.state) : all;
  }

  async summary(actor: Phase4Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const all = await this.rows(tenantId);
    return summarizeStates(all.map((row) => row.state));
  }

  async create(actor: Phase4Actor, dto: CreateStatutoryCertificateDto) {
    const tenantId = requireTenantId(actor.tenantId);
    if (!isStatutoryTypeKey(dto.typeKey)) {
      throw new BadRequestException("Choose a certificate type from the list.");
    }
    const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, tenantId }, select: { id: true } });
    if (!asset) throw new NotFoundException("Machine or equipment not found.");
    if (dto.issuedAt && dto.issuedAt > dto.expiresAt) {
      throw new BadRequestException("The expiry date must be after the issue date.");
    }
    const definition = STATUTORY_TYPES.find((type) => type.key === dto.typeKey)!;
    const reminderDays = dto.reminderDays ?? definition.defaultReminderDays;
    const created = await this.prisma.complianceRequirement.create({
      data: {
        tenantId,
        typeKey: dto.typeKey,
        subjectType: STATUTORY_SUBJECT_TYPE,
        subjectId: dto.assetId,
        title: dto.title?.trim() || definition.label,
        issuedAt: dto.issuedAt ?? null,
        expiresAt: dto.expiresAt,
        reminderDays,
        status: statutoryState(dto.expiresAt, reminderDays),
        providerName: dto.providerName?.trim() || null,
        certificateUrl: dto.certificateUrl ?? null,
        isActive: true
      }
    });
    return created;
  }

  async renew(actor: Phase4Actor, id: string, dto: RenewStatutoryCertificateDto) {
    const tenantId = requireTenantId(actor.tenantId);
    const existing = await this.prisma.complianceRequirement.findFirst({
      where: { id, tenantId, isActive: true, subjectType: STATUTORY_SUBJECT_TYPE }
    });
    if (!existing) throw new NotFoundException("Certificate not found.");
    if (dto.issuedAt && dto.issuedAt > dto.expiresAt) {
      throw new BadRequestException("The expiry date must be after the issue date.");
    }
    return this.prisma.complianceRequirement.update({
      where: { id },
      data: {
        issuedAt: dto.issuedAt ?? new Date(),
        expiresAt: dto.expiresAt,
        status: statutoryState(dto.expiresAt, existing.reminderDays),
        ...(dto.providerName !== undefined ? { providerName: dto.providerName.trim() || null } : {}),
        ...(dto.certificateUrl !== undefined ? { certificateUrl: dto.certificateUrl } : {})
      }
    });
  }

  async remove(actor: Phase4Actor, id: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const existing = await this.prisma.complianceRequirement.findFirst({
      where: { id, tenantId, isActive: true, subjectType: STATUTORY_SUBJECT_TYPE },
      select: { id: true }
    });
    if (!existing) throw new NotFoundException("Certificate not found.");
    await this.prisma.complianceRequirement.update({ where: { id }, data: { isActive: false } });
    return { id };
  }
}
