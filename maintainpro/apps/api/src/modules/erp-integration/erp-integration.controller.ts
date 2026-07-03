import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ErpAccessChecklistService } from "./erp-access-checklist.service";
import { ErpConfigService } from "./erp-config.service";
import { ErpDashboardService } from "./erp-dashboard.service";
import { ErpImportService } from "./erp-import.service";
import { ErpMappingService } from "./erp-mapping.service";
import { ErpMockSyncService } from "./erp-mock-sync.service";
import { ErpReconciliationService } from "./erp-reconciliation.service";
import type {
  CreateErpMappingDto,
  CreateImportBatchDto,
  ErpListQueryDto,
  ImportActionDto,
  MockSyncDto,
  ReconciliationActionDto,
  UpdateAccessChecklistDto,
  UpdateErpMappingDto
} from "./dto/erp.dto";

@ApiTags("ERP Integration")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("erp")
export class ErpIntegrationController {
  constructor(
    private readonly dashboard: ErpDashboardService,
    private readonly config: ErpConfigService,
    private readonly mappings: ErpMappingService,
    private readonly mockSync: ErpMockSyncService,
    private readonly imports: ErpImportService,
    private readonly reconciliation: ErpReconciliationService,
    private readonly checklist: ErpAccessChecklistService
  ) {}

  @Get("status")
  @Permissions("erp.view")
  getStatus() {
    return this.dashboard.getStatus().then((data) => ({ data, message: "ERP configuration status" }));
  }

  @Get("readiness")
  @Permissions("erp.view")
  getReadiness() {
    return this.dashboard.getDashboard().then((data) => ({ data, message: "ERP integration readiness" }));
  }

  @Get("mappings")
  @Permissions("erp.view")
  listMappings() {
    return this.mappings.findAll().then((data) => ({ data, message: "ERP field mappings" }));
  }

  @Post("mappings")
  @Permissions("erp.manage")
  createMapping(@Body() body: CreateErpMappingDto) {
    return this.mappings.create(body).then((data) => ({ data, message: "ERP mapping created" }));
  }

  @Patch("mappings/:id")
  @Permissions("erp.manage")
  updateMapping(@Param("id") id: string, @Body() body: UpdateErpMappingDto) {
    return this.mappings.update(id, body).then((data) => ({ data, message: "ERP mapping updated" }));
  }

  @Get("mock/status")
  @Permissions("erp.view")
  mockStatus() {
    return this.mockSync.getStatus().then((data) => ({ data, message: "Mock sync status" }));
  }

  @Post("mock/sync")
  @Permissions("erp.manage")
  runMockSync(@Body() body: MockSyncDto) {
    return this.mockSync.runMockSync(body).then((data) => ({ data, message: "Mock ERP sync completed" }));
  }

  @Post("import/batch")
  @Permissions("erp.import")
  createImportBatch(@Body() body: CreateImportBatchDto) {
    return this.imports.createBatch(body).then((data) => ({ data, message: "Import batch uploaded" }));
  }

  @Get("import/batches")
  @Permissions("erp.view")
  listImportBatches() {
    return this.imports.findAll().then((data) => ({ data, message: "Import batches" }));
  }

  @Get("import/batches/:id")
  @Permissions("erp.view")
  getImportBatch(@Param("id") id: string) {
    return this.imports.findOne(id).then((data) => ({ data, message: "Import batch" }));
  }

  @Post("import/batches/:id/dry-run")
  @Permissions("erp.import")
  dryRunImport(@Param("id") id: string) {
    return this.imports.dryRun(id).then((data) => ({ data, message: "Import dry-run completed" }));
  }

  @Post("import/batches/:id/approve")
  @Permissions("erp.import")
  approveImport(@Param("id") id: string, @Body() body: ImportActionDto) {
    return this.imports.approve(id, body).then((data) => ({ data, message: "Import batch approved" }));
  }

  @Post("import/batches/:id/apply")
  @Permissions("erp.import")
  applyImport(@Param("id") id: string, @Body() body: ImportActionDto) {
    return this.imports.apply(id, body).then((data) => ({ data, message: "Import batch applied (staging)" }));
  }

  @Post("import/batches/:id/cancel")
  @Permissions("erp.import")
  cancelImport(@Param("id") id: string, @Body() body: ImportActionDto) {
    return this.imports.cancel(id, body).then((data) => ({ data, message: "Import batch cancelled" }));
  }

  @Get("reconciliation")
  @Permissions("erp.view")
  listReconciliation(@Query() query: ErpListQueryDto) {
    return this.reconciliation.findAll(query).then((data) => ({ data, message: "ERP reconciliation" }));
  }

  @Get("reconciliation/:id")
  @Permissions("erp.view")
  getReconciliation(@Param("id") id: string) {
    return this.reconciliation.findOne(id).then((data) => ({ data, message: "Reconciliation mismatch" }));
  }

  @Post("reconciliation/:id/review")
  @Permissions("erp.reconcile")
  reviewMismatch(@Param("id") id: string, @Body() body: ReconciliationActionDto) {
    return this.reconciliation.review(id, body).then((data) => ({ data, message: "Mismatch reviewed" }));
  }

  @Post("reconciliation/:id/accept")
  @Permissions("erp.reconcile")
  acceptMismatch(@Param("id") id: string, @Body() body: ReconciliationActionDto) {
    return this.reconciliation.accept(id, body).then((data) => ({ data, message: "Mismatch accepted" }));
  }

  @Post("reconciliation/:id/mark-corrected")
  @Permissions("erp.reconcile")
  correctMismatch(@Param("id") id: string, @Body() body: ReconciliationActionDto) {
    return this.reconciliation.markCorrected(id, body).then((data) => ({ data, message: "Mismatch corrected" }));
  }

  @Get("access-checklist")
  @Permissions("erp.view")
  getAccessChecklist() {
    return this.checklist.getReadiness().then((data) => ({ data, message: "Bileeta API access checklist" }));
  }

  @Patch("access-checklist/:id")
  @Permissions("erp.manage")
  updateChecklistItem(@Param("id") id: string, @Body() body: UpdateAccessChecklistDto) {
    return this.checklist.update(id, body).then((data) => ({ data, message: "Checklist item updated" }));
  }

  @Get("report")
  @Permissions("erp.view")
  getReport() {
    return this.dashboard.getReport().then((data) => ({ data, message: "ERP integration report" }));
  }

  @Get("connection-test")
  @Permissions("erp.view")
  connectionTest() {
    return this.config.getConnectionStatus().then((data) => ({ data, message: "ERP connection test" }));
  }
}
