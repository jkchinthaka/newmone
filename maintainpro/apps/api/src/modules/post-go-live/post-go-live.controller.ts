import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ChangeRequestsService } from "./change-requests.service";
import type {
  ApproveChangeRequestDto,
  ChangeRequestStatusDto,
  CompleteHypercareDto,
  CreateChangeRequestDto,
  CreateHypercareDto,
  CreateTrainingDto,
  ExtendHypercareDto,
  OperationsListQueryDto,
  RejectChangeRequestDto,
  UpdateHandoverDto,
  UpdateHypercareDto,
  UpdateTrainingDto
} from "./dto/operations.dto";
import { HandoverService } from "./handover.service";
import { HypercareService } from "./hypercare.service";
import { OperationsDashboardService } from "./operations-dashboard.service";
import { TrainingService } from "./training.service";

@ApiTags("Post-Go-Live")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("post-go-live")
export class PostGoLiveController {
  constructor(
    private readonly dashboard: OperationsDashboardService,
    private readonly training: TrainingService,
    private readonly hypercare: HypercareService,
    private readonly handover: HandoverService
  ) {}

  @Get("dashboard")
  @Permissions("operations.view")
  getDashboard() {
    return this.dashboard.getDashboard().then((data) => ({ data, message: "Operations dashboard" }));
  }

  @Get("monitoring/dashboard")
  @Permissions("operations.view")
  getMonitoring() {
    return this.dashboard.getMonitoringDashboard().then((data) => ({ data, message: "Production monitoring" }));
  }

  @Get("report")
  @Permissions("operations.view")
  getReport() {
    return this.dashboard.getPostGoLiveReport().then((data) => ({ data, message: "Post-go-live report" }));
  }

  @Get("training")
  @Permissions("operations.view")
  listTraining(@Query() query: OperationsListQueryDto) {
    return this.training.findAll(query).then((r) => ({ data: r.items, meta: r.meta, message: "Training sessions" }));
  }

  @Post("training")
  @Permissions("operations.manage")
  createTraining(@Body() body: CreateTrainingDto) {
    return this.training.create(body).then((data) => ({ data, message: "Training session created" }));
  }

  @Patch("training/:id")
  @Permissions("operations.manage")
  updateTraining(@Param("id") id: string, @Body() body: UpdateTrainingDto) {
    return this.training.update(id, body).then((data) => ({ data, message: "Training session updated" }));
  }

  @Post("training/:id/complete")
  @Permissions("operations.manage")
  completeTraining(@Param("id") id: string) {
    return this.training.complete(id).then((data) => ({ data, message: "Training completed" }));
  }

  @Post("training/:id/mark-retraining")
  @Permissions("operations.manage")
  markRetraining(@Param("id") id: string, @Body() body: { reason?: string }) {
    return this.training.markRetraining(id, body.reason).then((data) => ({ data, message: "Retraining required" }));
  }

  @Get("hypercare")
  @Permissions("operations.view")
  listHypercare() {
    return this.hypercare.findAll().then((data) => ({ data, message: "Hypercare plans" }));
  }

  @Post("hypercare")
  @Permissions("operations.manage")
  createHypercare(@Body() body: CreateHypercareDto) {
    return this.hypercare.create(body).then((data) => ({ data, message: "Hypercare plan created" }));
  }

  @Patch("hypercare/:id")
  @Permissions("operations.manage")
  updateHypercare(@Param("id") id: string, @Body() body: UpdateHypercareDto) {
    return this.hypercare.update(id, body).then((data) => ({ data, message: "Hypercare plan updated" }));
  }

  @Post("hypercare/:id/complete")
  @Permissions("operations.manage")
  completeHypercare(@Param("id") id: string, @Body() body: CompleteHypercareDto) {
    return this.hypercare.complete(id, body).then((data) => ({ data, message: "Hypercare completed" }));
  }

  @Post("hypercare/:id/extend")
  @Permissions("operations.manage")
  extendHypercare(@Param("id") id: string, @Body() body: ExtendHypercareDto) {
    return this.hypercare.extend(id, body).then((data) => ({ data, message: "Hypercare extended" }));
  }

  @Get("handover")
  @Permissions("operations.view")
  getHandover() {
    return this.handover.getHandover().then((data) => ({ data, message: "Support handover" }));
  }

  @Patch("handover")
  @Permissions("operations.manage")
  updateHandover(@Body() body: UpdateHandoverDto) {
    return this.handover.updateHandover(body).then((data) => ({ data, message: "Handover updated" }));
  }
}

@ApiTags("Change Requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("change-requests")
export class ChangeRequestsController {
  constructor(private readonly service: ChangeRequestsService) {}

  @Get()
  @Permissions("operations.view")
  list(@Query() query: OperationsListQueryDto) {
    return this.service.findAll(query).then((r) => ({ data: r.items, meta: r.meta, message: "Change requests" }));
  }

  @Get(":id")
  @Permissions("operations.view")
  getOne(@Param("id") id: string) {
    return this.service.findOne(id).then((data) => ({ data, message: "Change request" }));
  }

  @Post()
  @Permissions("change_request.create")
  create(@Body() body: CreateChangeRequestDto) {
    return this.service.create(body).then((data) => ({ data, message: "Change request created" }));
  }

  @Post(":id/approve")
  @Permissions("change_request.approve")
  approve(@Param("id") id: string, @Body() body: ApproveChangeRequestDto) {
    return this.service.approve(id, body).then((data) => ({ data, message: "Change request approved" }));
  }

  @Post(":id/reject")
  @Permissions("change_request.approve")
  reject(@Param("id") id: string, @Body() body: RejectChangeRequestDto) {
    return this.service.reject(id, body).then((data) => ({ data, message: "Change request rejected" }));
  }

  @Post(":id/status")
  @Permissions("change_request.manage")
  status(@Param("id") id: string, @Body() body: ChangeRequestStatusDto) {
    return this.service.changeStatus(id, body).then((data) => ({ data, message: "Change request status updated" }));
  }
}
