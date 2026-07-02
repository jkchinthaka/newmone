import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CreateQaIssueDto,
  QaAcceptRiskDto,
  QaAssignDto,
  QaCloseDto,
  QaIssueListQueryDto,
  QaRcaDto,
  QaRegressionTestDto,
  QaReleaseReportQueryDto,
  QaReopenDto,
  QaStatusChangeDto,
  QaTriageDto,
  UpdateQaIssueDto
} from "./dto/qa.dto";
import { QaIssuesService } from "./qa-issues.service";

const QA_READERS = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"] as const;

@ApiTags("QA")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("qa")
export class QaController {
  constructor(private readonly qaService: QaIssuesService) {}

  @Get("categories")
  @Permissions("qa.view")
  getCategories() {
    const data = this.qaService.getCategories();
    return { data, message: "QA categories fetched" };
  }

  @Get("dashboard")
  @Permissions("qa.view")
  getDashboard() {
    return this.qaService.getDashboard().then((data) => ({ data, message: "QA dashboard fetched" }));
  }

  @Get("issues")
  @Permissions("qa.view")
  listIssues(@Query() query: QaIssueListQueryDto) {
    return this.qaService.findAll(query).then((result) => ({
      data: result.items,
      meta: result.meta,
      message: "QA issues fetched"
    }));
  }

  @Get("issues/:id")
  @Permissions("qa.view")
  getIssue(@Param("id") id: string) {
    return this.qaService.findOne(id).then((data) => ({ data, message: "QA issue fetched" }));
  }

  @Post("issues")
  @Permissions("qa.create")
  createIssue(@Body() body: CreateQaIssueDto) {
    return this.qaService.create(body).then((data) => ({ data, message: "QA issue reported" }));
  }

  @Patch("issues/:id")
  @Permissions("qa.manage")
  updateIssue(@Param("id") id: string, @Body() body: UpdateQaIssueDto) {
    return this.qaService.update(id, body).then((data) => ({ data, message: "QA issue updated" }));
  }

  @Post("issues/:id/triage")
  @Permissions("qa.manage")
  triage(@Param("id") id: string, @Body() body: QaTriageDto) {
    return this.qaService.triage(id, body).then((data) => ({ data, message: "QA issue triaged" }));
  }

  @Post("issues/:id/assign")
  @Permissions("qa.manage")
  assign(@Param("id") id: string, @Body() body: QaAssignDto) {
    return this.qaService.assign(id, body).then((data) => ({ data, message: "QA issue assigned" }));
  }

  @Post("issues/:id/status")
  @Permissions("qa.manage")
  changeStatus(@Param("id") id: string, @Body() body: QaStatusChangeDto) {
    return this.qaService.changeStatus(id, body).then((data) => ({ data, message: "QA issue status updated" }));
  }

  @Post("issues/:id/rca")
  @Permissions("qa.manage")
  addRca(@Param("id") id: string, @Body() body: QaRcaDto) {
    return this.qaService.addRca(id, body).then((data) => ({ data, message: "RCA recorded" }));
  }

  @Post("issues/:id/regression-test")
  @Permissions("qa.manage")
  addRegression(@Param("id") id: string, @Body() body: QaRegressionTestDto) {
    return this.qaService.addRegressionTest(id, body).then((data) => ({ data, message: "Regression test recorded" }));
  }

  @Post("issues/:id/accept-risk")
  @Permissions("qa.accept_risk")
  acceptRisk(@Param("id") id: string, @Body() body: QaAcceptRiskDto) {
    return this.qaService.acceptRisk(id, body).then((data) => ({ data, message: "Risk accepted" }));
  }

  @Post("issues/:id/reopen")
  @Permissions("qa.manage")
  reopen(@Param("id") id: string, @Body() body: QaReopenDto) {
    return this.qaService.reopen(id, body).then((data) => ({ data, message: "QA issue reopened" }));
  }

  @Post("issues/:id/close")
  @Permissions("qa.manage")
  close(@Param("id") id: string, @Body() body: QaCloseDto) {
    return this.qaService.close(id, body).then((data) => ({ data, message: "QA issue closed" }));
  }

  @Post("issues/from-health-check")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("qa.manage")
  fromHealthCheck(
    @Body()
    body: { checkKey: string; checkLabel: string; message: string; category?: string; severity?: string }
  ) {
    return this.qaService
      .createFromHealthCheck(body as Parameters<QaIssuesService["createFromHealthCheck"]>[0])
      .then((data) => ({ data, message: "Incident created from health check" }));
  }

  @Get("reports/release-quality")
  @Permissions("qa.view")
  releaseQuality(@Query() query: QaReleaseReportQueryDto) {
    return this.qaService.releaseQualityReport(query).then((data) => ({ data, message: "Release quality report" }));
  }

  @Get("reports/export")
  @Permissions("qa.export")
  exportReport(@Query() query: QaReleaseReportQueryDto) {
    return this.qaService.exportReport(query).then((data) => ({ data, message: "QA report exported" }));
  }
}
