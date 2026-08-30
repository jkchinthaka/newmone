import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { MobileFgService } from "./mobile-fg.service";

type AuthedRequest = {
  user: JwtPayload;
  headers: Record<string, string | string[] | undefined>;
};

@ApiTags("Mobile FG")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("mobile/fg")
export class MobileFgController {
  constructor(private readonly service: MobileFgService) {}

  @Post("session/bootstrap")
  @Permissions("fg.access")
  async bootstrap(@Req() req: AuthedRequest) {
    return this.service.bootstrap(req);
  }

  @Get("session")
  @Permissions("fg.access")
  async session(@Req() req: AuthedRequest) {
    return this.service.getSession(req);
  }

  @Delete("session")
  @Permissions("fg.access")
  async deleteSession(@Req() req: AuthedRequest) {
    return this.service.deleteSession(req);
  }

  @Get("cl30/vehicles")
  @Permissions("fg.recording.view")
  async cl30Vehicles(@Req() req: AuthedRequest, @Query("q") q?: string) {
    return this.service.listCl30Vehicles(req, q);
  }

  @Post("cl30/records/open")
  @Permissions("fg.recording.create")
  async openCl30(
    @Req() req: AuthedRequest,
    @Body() body: { date?: string; occurrenceToken?: string }
  ) {
    return this.service.openCl30Record(req, body ?? {});
  }

  @Get("cl30/records/:recordId")
  @Permissions("fg.recording.view")
  async getCl30(@Req() req: AuthedRequest, @Param("recordId") recordId: string) {
    return this.service.getCl30Record(req, recordId);
  }

  @Post("cl30/records/:recordId/save")
  @Permissions("fg.recording.edit")
  async saveCl30(
    @Req() req: AuthedRequest,
    @Param("recordId") recordId: string,
    @Body() body: { fields?: unknown; expectedDraftVersion?: unknown }
  ) {
    return this.service.saveCl30Record(req, recordId, body ?? {});
  }

  @Post("cl30/records/:recordId/submit")
  @Permissions("fg.recording.submit")
  async submitCl30(
    @Req() req: AuthedRequest,
    @Param("recordId") recordId: string,
    @Body() body: { idempotencyKey?: string }
  ) {
    return this.service.submitCl30Record(req, recordId, body ?? {});
  }

  @Get("history")
  @Permissions("fg.recording.view")
  async history(
    @Req() req: AuthedRequest,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("formCode") formCode?: string,
    @Query("vehicle") vehicle?: string,
    @Query("status") status?: string,
    @Query("page") page?: string
  ) {
    return this.service.history(req, { dateFrom, dateTo, formCode, vehicle, status, page });
  }

  @Get("reviews")
  @Permissions("fg.review.view")
  async reviews(@Req() req: AuthedRequest, @Query("page") page?: string) {
    return this.service.listReviews(req, page);
  }

  @Get("reviews/:submissionId")
  @Permissions("fg.review.view")
  async review(@Req() req: AuthedRequest, @Param("submissionId") submissionId: string) {
    return this.service.getReview(req, submissionId);
  }

  @Post("reviews/:submissionId/decision")
  @Permissions("fg.review.perform")
  async reviewDecision(
    @Req() req: AuthedRequest,
    @Param("submissionId") submissionId: string,
    @Body() body: { decision?: string; reviewNote?: string; idempotencyKey?: string }
  ) {
    return this.service.reviewDecision(req, submissionId, body ?? {});
  }

  @Get("qa")
  @Permissions("fg.qa.view")
  async qa(@Req() req: AuthedRequest, @Query("page") page?: string) {
    return this.service.listQa(req, page);
  }

  @Get("qa/:submissionId")
  @Permissions("fg.qa.view")
  async qaItem(@Req() req: AuthedRequest, @Param("submissionId") submissionId: string) {
    return this.service.getQa(req, submissionId);
  }

  @Post("qa/:submissionId/decision")
  @Permissions("fg.qa.disposition")
  async qaDecision(
    @Req() req: AuthedRequest,
    @Param("submissionId") submissionId: string,
    @Body() body: { decision?: string; note?: string; idempotencyKey?: string }
  ) {
    return this.service.qaDecision(req, submissionId, body ?? {});
  }
}
