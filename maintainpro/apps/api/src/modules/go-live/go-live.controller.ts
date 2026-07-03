import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CutoverChecklistService } from "./cutover-checklist.service";
import { DecisionBoardService } from "./decision-board.service";
import type {
  CreateCutoverItemDto,
  CreateGoLiveSignOffDto,
  CreatePilotRolloutDto,
  CreateRollbackPlanDto,
  CreateRolloutWaveDto,
  ExtendPilotDto,
  GoLiveListQueryDto,
  RecordGoLiveDecisionDto,
  RevokeSignOffDto,
  UpdateCutoverItemDto,
  UpdatePilotRolloutDto,
  UpdateRollbackPlanDto,
  UpdateRolloutWaveDto,
  WaveActionDto
} from "./dto/go-live.dto";
import { GoLiveDashboardService } from "./go-live-dashboard.service";
import { GoLiveSignOffService } from "./go-live-signoff.service";
import { PilotRolloutService } from "./pilot-rollout.service";
import { RollbackPlanService } from "./rollback-plan.service";
import { RolloutWavesService } from "./rollout-waves.service";

@ApiTags("Go-Live Control")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("go-live")
export class GoLiveController {
  constructor(
    private readonly dashboard: GoLiveDashboardService,
    private readonly pilots: PilotRolloutService,
    private readonly cutover: CutoverChecklistService,
    private readonly waves: RolloutWavesService,
    private readonly decisions: DecisionBoardService,
    private readonly rollback: RollbackPlanService,
    private readonly signOff: GoLiveSignOffService
  ) {}

  @Get("dashboard")
  @Permissions("go_live.view")
  getDashboard() {
    return this.dashboard.getDashboard().then((data) => ({ data, message: "Go-live dashboard" }));
  }

  @Get("live-issues")
  @Permissions("go_live.view")
  getLiveIssues() {
    return this.dashboard.getLiveIssueTracker().then((data) => ({ data, message: "Live issue tracker" }));
  }

  @Get("final-report")
  @Permissions("go_live.view")
  getFinalReport() {
    return this.dashboard.getFinalReport().then((data) => ({ data, message: "Final go-live report" }));
  }

  @Get("export")
  @Permissions("go_live.export")
  exportReport() {
    return this.dashboard.exportReport().then((data) => ({ data, message: "Go-live report exported" }));
  }

  @Get("pilots")
  @Permissions("go_live.view")
  listPilots(@Query() query: GoLiveListQueryDto) {
    return this.pilots.findAll(query).then((r) => ({ data: r.items, meta: r.meta, message: "Pilot rollouts" }));
  }

  @Post("pilots")
  @Permissions("go_live.manage")
  createPilot(@Body() body: CreatePilotRolloutDto) {
    return this.pilots.create(body).then((data) => ({ data, message: "Pilot rollout created" }));
  }

  @Patch("pilots/:id")
  @Permissions("go_live.manage")
  updatePilot(@Param("id") id: string, @Body() body: UpdatePilotRolloutDto) {
    return this.pilots.update(id, body).then((data) => ({ data, message: "Pilot rollout updated" }));
  }

  @Post("pilots/:id/start")
  @Permissions("go_live.manage")
  startPilot(@Param("id") id: string) {
    return this.pilots.start(id).then((data) => ({ data, message: "Pilot rollout started" }));
  }

  @Post("pilots/:id/complete")
  @Permissions("go_live.manage")
  completePilot(@Param("id") id: string) {
    return this.pilots.complete(id).then((data) => ({ data, message: "Pilot rollout completed" }));
  }

  @Post("pilots/:id/extend")
  @Permissions("go_live.manage")
  extendPilot(@Param("id") id: string, @Body() body: ExtendPilotDto) {
    return this.pilots.extend(id, body).then((data) => ({ data, message: "Pilot rollout extended" }));
  }

  @Get("cutover-checklist")
  @Permissions("go_live.view")
  getCutoverChecklist() {
    return this.cutover.findAll().then((data) => ({ data, message: "Cutover checklist" }));
  }

  @Post("cutover-checklist/items")
  @Permissions("go_live.manage")
  createCutoverItem(@Body() body: CreateCutoverItemDto) {
    return this.cutover.createItem(body).then((data) => ({ data, message: "Cutover item created" }));
  }

  @Patch("cutover-checklist/items/:id")
  @Permissions("go_live.manage")
  updateCutoverItem(@Param("id") id: string, @Body() body: UpdateCutoverItemDto) {
    return this.cutover.updateItem(id, body).then((data) => ({ data, message: "Cutover item updated" }));
  }

  @Get("waves")
  @Permissions("go_live.view")
  listWaves() {
    return this.waves.findAll().then((data) => ({ data, message: "Rollout waves" }));
  }

  @Post("waves")
  @Permissions("go_live.manage")
  createWave(@Body() body: CreateRolloutWaveDto) {
    return this.waves.create(body).then((data) => ({ data, message: "Rollout wave created" }));
  }

  @Patch("waves/:id")
  @Permissions("go_live.manage")
  updateWave(@Param("id") id: string, @Body() body: UpdateRolloutWaveDto) {
    return this.waves.update(id, body).then((data) => ({ data, message: "Rollout wave updated" }));
  }

  @Post("waves/:id/start")
  @Permissions("go_live.manage")
  startWave(@Param("id") id: string) {
    return this.waves.start(id).then((data) => ({ data, message: "Rollout wave started" }));
  }

  @Post("waves/:id/complete")
  @Permissions("go_live.manage")
  completeWave(@Param("id") id: string, @Body() body: WaveActionDto) {
    return this.waves.complete(id, body).then((data) => ({ data, message: "Rollout wave completed" }));
  }

  @Post("waves/:id/pause")
  @Permissions("go_live.manage")
  pauseWave(@Param("id") id: string, @Body() body: WaveActionDto) {
    return this.waves.pause(id, body).then((data) => ({ data, message: "Rollout wave paused" }));
  }

  @Get("decision-board")
  @Permissions("go_live.view")
  getDecisionBoard() {
    return this.decisions.getDecisionBoard().then((data) => ({ data, message: "Go/No-Go decision board" }));
  }

  @Post("decision-board/decision")
  @Permissions("go_live.manage")
  recordDecision(@Body() body: RecordGoLiveDecisionDto) {
    return this.decisions.recordDecision(body).then((data) => ({ data, message: "Go-live decision recorded" }));
  }

  @Get("rollback-plan")
  @Permissions("go_live.view")
  getRollbackPlan() {
    return this.rollback.findAll().then((data) => ({ data, message: "Rollback plans" }));
  }

  @Post("rollback-plan")
  @Permissions("go_live.manage")
  createRollbackPlan(@Body() body: CreateRollbackPlanDto) {
    return this.rollback.create(body).then((data) => ({ data, message: "Rollback plan created" }));
  }

  @Patch("rollback-plan/:id")
  @Permissions("go_live.manage")
  updateRollbackPlan(@Param("id") id: string, @Body() body: UpdateRollbackPlanDto) {
    return this.rollback.update(id, body).then((data) => ({ data, message: "Rollback plan updated" }));
  }

  @Get("signoff")
  @Permissions("go_live.view")
  listSignOffs() {
    return this.signOff.findAll().then((data) => ({ data, message: "Management sign-offs" }));
  }

  @Post("signoff")
  @Permissions("go_live.sign_off")
  createSignOff(@Body() body: CreateGoLiveSignOffDto) {
    return this.signOff.createSignOff(body).then((data) => ({ data, message: "Sign-off recorded" }));
  }

  @Post("signoff/:id/revoke")
  @Permissions("go_live.sign_off")
  revokeSignOff(@Param("id") id: string, @Body() body: RevokeSignOffDto) {
    return this.signOff.revokeSignOff(id, body).then((data) => ({ data, message: "Sign-off revoked" }));
  }
}
