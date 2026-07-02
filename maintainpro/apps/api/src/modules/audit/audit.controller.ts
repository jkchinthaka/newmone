import { Controller, Get, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";

import { AuditService } from "./audit.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Generic listing with filters. Admin/Asset Manager only. */
  @Get()
  @Permissions("audit.view")
  async list(
    @Req() req: AuthedRequest,
    @Query("entity") entity?: string,
    @Query("entityId") entityId?: string,
    @Query("actorId") actorId?: string,
    @Query("module") module?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string
  ) {
    const page = Number(pageRaw ?? 1);
    const pageSize = Number(pageSizeRaw ?? 20);
    const data = await this.auditService.list(req.user, {
      entity,
      entityId,
      actorId,
      module,
      from,
      to,
      page,
      pageSize
    });
    return { data: data.items, message: "Audit logs fetched", meta: data.pagination };
  }

  @Get("export")
  @Permissions("audit.view")
  async export(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query("entity") entity?: string,
    @Query("entityId") entityId?: string,
    @Query("actorId") actorId?: string,
    @Query("module") module?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const file = await this.auditService.export(req.user, {
      entity,
      entityId,
      actorId,
      module,
      from,
      to
    });
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }

  /** Per-record history convenience endpoint used by the UI History drawer. */
  @Get(":entity/:entityId")
  @Permissions("audit.view")
  async forEntity(
    @Req() req: AuthedRequest,
    @Param("entity") entity: string,
    @Param("entityId") entityId: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string
  ) {
    const page = Number(pageRaw ?? 1);
    const pageSize = Number(pageSizeRaw ?? 50);
    const data = await this.auditService.forEntity(req.user, entity, entityId, page, pageSize);
    return { data: data.items, message: "Audit history fetched", meta: data.pagination };
  }
}
