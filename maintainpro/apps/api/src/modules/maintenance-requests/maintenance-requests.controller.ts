import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  AssetLookupQueryDto,
  VehicleLookupQueryDto,
  CancelMaintenanceRequestDto,
  ConvertToWorkOrderDto,
  CreateMaintenanceRequestDto,
  MaintenanceRequestListQueryDto,
  MarkDuplicateDto,
  RejectMaintenanceRequestDto,
  RequesterRespondDto,
  RequestInformationDto,
  ResumeReviewDto,
  TriageMaintenanceRequestDto
} from "./dto/maintenance-request.dto";
import { MaintenanceRequestsService } from "./maintenance-requests.service";

interface AuthedRequest {
  user?: {
    sub: string;
    email?: string;
    role: string;
    tenantId?: string | null;
    permissions?: string[];
  };
}

/**
 * Review, approval, and conversion stay on the maintenance roles.
 * Create, list, detail, respond, and cancel use the permission guard only, so an
 * authorized employee in Finance, Farms, or any other department role is not
 * rejected for being absent from this list.
 */
const TRIAGE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR"
] as const;

@ApiTags("Maintenance Requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("maintenance-requests")
export class MaintenanceRequestsController {
  constructor(private readonly requests: MaintenanceRequestsService) {}

  @Get("problem-categories")
  @Permissions("maintenance_requests.view_own")
  async problemCategories(@Req() req: AuthedRequest) {
    const data = await this.requests.listProblemCategories(req.user?.tenantId ?? null);
    return { data, message: "Problem categories fetched" };
  }

  @Post("problem-categories/seed")
  @Roles(...TRIAGE_ROLES)
  async seedCategories(@Req() req: AuthedRequest) {
    const data = await this.requests.seedProblemCategories(req.user?.tenantId ?? null);
    return { data, message: "Problem categories seeded" };
  }

  @Get()
  @Permissions("maintenance_requests.view_own")
  async list(@Req() req: AuthedRequest, @Query() query: MaintenanceRequestListQueryDto) {
    const data = await this.requests.list(req.user?.tenantId ?? null, req.user!, query);
    return { data: data.items, meta: data.meta, message: "Maintenance requests fetched" };
  }

  @Get("summary")
  @Permissions("maintenance_requests.view_own")
  async summary(@Req() req: AuthedRequest, @Query("mine") mine?: string) {
    const data = await this.requests.summary(req.user?.tenantId ?? null, req.user!, {
      mine: mine === "true" || mine === "1"
    });
    return { data, message: "Maintenance request summary" };
  }

  @Get("asset-lookup")
  @Permissions("maintenance_requests.create")
  async assetLookup(@Req() req: AuthedRequest, @Query() query: AssetLookupQueryDto) {
    const data = await this.requests.lookupSelectableAssets(
      req.user?.tenantId ?? null,
      query.q ?? "",
      query.limit,
      query.assetId
    );
    return { data, message: "Machines matched" };
  }

  @Get("vehicle-lookup")
  @Permissions("maintenance_requests.create")
  async vehicleLookup(@Req() req: AuthedRequest, @Query() query: VehicleLookupQueryDto) {
    const data = await this.requests.lookupSelectableVehicles(
      req.user?.tenantId ?? null,
      query.q ?? "",
      query.limit
    );
    return { data, message: "Vehicles matched" };
  }

  @Post()
  @Permissions("maintenance_requests.create")
  async create(@Req() req: AuthedRequest, @Body() body: CreateMaintenanceRequestDto) {
    const data = await this.requests.create(req.user?.tenantId ?? null, req.user!, body);
    return { data, message: "Maintenance request created" };
  }

  @Get(":id")
  @Permissions("maintenance_requests.view_own")
  async detail(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.requests.findOne(req.user?.tenantId ?? null, id, req.user!);
    return { data, message: "Maintenance request fetched" };
  }

  @Get(":id/history")
  @Permissions("maintenance_requests.view_own")
  async history(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.requests.history(req.user?.tenantId ?? null, id, req.user!);
    return { data, message: "Request history fetched" };
  }

  @Get(":id/duplicate-candidates")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.triage")
  async duplicates(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.requests.duplicateCandidates(
      req.user?.tenantId ?? null,
      id,
      req.user!
    );
    return { data, message: "Duplicate candidates fetched" };
  }

  @Get(":id/repeat-history")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.triage")
  async repeatHistory(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.requests.repeatHistory(req.user?.tenantId ?? null, id, req.user!);
    return { data, message: "Repeat history fetched" };
  }

  @Post(":id/start-review")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.triage")
  async startReview(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.requests.startReview(req.user?.tenantId ?? null, id, req.user!);
    return { data, message: "Review started" };
  }

  @Post(":id/triage")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.triage")
  async triage(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: TriageMaintenanceRequestDto
  ) {
    const data = await this.requests.triage(req.user?.tenantId ?? null, id, req.user!, body);
    return { data, message: "Request triage updated" };
  }

  @Post(":id/approve")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.approve")
  async approve(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.requests.approve(req.user?.tenantId ?? null, id, req.user!);
    return { data, message: "Request approved" };
  }

  @Post(":id/needs-information")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.triage")
  async needsInformation(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: RequestInformationDto
  ) {
    const data = await this.requests.requestInformation(
      req.user?.tenantId ?? null,
      id,
      req.user!,
      body
    );
    return { data, message: "Requester asked for more information" };
  }

  @Post(":id/respond")
  @Permissions("maintenance_requests.create")
  async respond(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: RequesterRespondDto
  ) {
    const data = await this.requests.respondToInformationRequest(
      req.user?.tenantId ?? null,
      id,
      req.user!,
      body
    );
    return { data, message: "Requester response recorded" };
  }

  @Post(":id/resume-review")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.triage")
  async resumeReview(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: ResumeReviewDto
  ) {
    const data = await this.requests.resumeReview(req.user?.tenantId ?? null, id, req.user!, body);
    return { data, message: "Review resumed" };
  }

  @Post(":id/reject")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.reject")
  async reject(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: RejectMaintenanceRequestDto
  ) {
    const data = await this.requests.reject(req.user?.tenantId ?? null, id, req.user!, body);
    return { data, message: "Request closed without work order" };
  }

  @Post(":id/cancel")
  @Permissions("maintenance_requests.cancel_own")
  async cancel(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: CancelMaintenanceRequestDto
  ) {
    const data = await this.requests.cancel(req.user?.tenantId ?? null, id, req.user!, body);
    return { data, message: "Request cancelled" };
  }

  @Post(":id/mark-duplicate")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.triage")
  async markDuplicate(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: MarkDuplicateDto
  ) {
    const data = await this.requests.markDuplicate(req.user?.tenantId ?? null, id, req.user!, body);
    return { data, message: "Request marked as duplicate" };
  }

  @Post(":id/convert-to-work-order")
  @Roles(...TRIAGE_ROLES)
  @Permissions("maintenance_requests.convert")
  async convert(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: ConvertToWorkOrderDto
  ) {
    const data = await this.requests.convertToWorkOrder(
      req.user?.tenantId ?? null,
      id,
      req.user!,
      body
    );
    return { data, message: data.alreadyConverted ? "Already converted" : "Converted to work order" };
  }
}
