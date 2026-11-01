import { Body, Controller, HttpCode, Logger, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { SelfService } from "../../common/decorators/self-service.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";

export class ClientErrorDto {
  @IsString()
  @MaxLength(80)
  source!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  digest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  route?: string;
}

/** One line, no control characters, capped: client text must never be able to forge extra log lines. */
export function cleanLogText(value: string | undefined, max = 120): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

export function clientErrorLine(user: Pick<JwtPayload, "sub" | "tenantId" | "role">, dto: ClientErrorDto): string {
  return [
    "client-error",
    `tenant=${cleanLogText(user.tenantId ?? "none", 40)}`,
    `user=${cleanLogText(user.sub, 40)}`,
    `role=${cleanLogText(String(user.role ?? ""), 40)}`,
    `source="${cleanLogText(dto.source, 80)}"`,
    `error=${cleanLogText(dto.name, 80)}`,
    `digest=${cleanLogText(dto.digest, 80) || "-"}`,
    `route=${cleanLogText(dto.route, 200) || "-"}`
  ].join(" ");
}

@ApiTags("Client errors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("client-errors")
export class ClientErrorsController {
  private readonly logger = new Logger("ClientErrors");

  /** Screens that crash report only the safe fields (no message, stack or form data). */
  @Post()
  @SelfService()
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  report(@Req() req: { user: JwtPayload }, @Body() dto: ClientErrorDto): void {
    this.logger.warn(clientErrorLine(req.user, dto));
  }
}
