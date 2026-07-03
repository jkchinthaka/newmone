import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type {
  AssignTicketDto,
  CloseTicketDto,
  CreateEscalationRuleDto,
  CreateReleaseDto,
  CreateSupportTicketDto,
  MarkDeployedDto,
  OperationsListQueryDto,
  ReopenTicketDto,
  ResolveTicketDto,
  RollbackReleaseDto,
  TicketStatusDto,
  UpdateEscalationRuleDto,
  UpdateReleaseDto,
  UpdateSupportTicketDto
} from "./dto/operations.dto";
import { ReleasesService } from "./releases.service";
import { SupportTicketsService } from "./support-tickets.service";

@ApiTags("Support")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("support")
export class SupportController {
  constructor(private readonly tickets: SupportTicketsService) {}

  @Get("tickets/mine")
  @Permissions("support.create")
  listMyTickets(@Query() query: OperationsListQueryDto) {
    return this.tickets.findAll(query).then((r) => ({ data: r.items, meta: r.meta, message: "My support tickets" }));
  }

  @Get("tickets")
  @Permissions("operations.view")
  listTickets(@Query() query: OperationsListQueryDto) {
    return this.tickets.findAll(query).then((r) => ({ data: r.items, meta: r.meta, message: "Support tickets" }));
  }

  @Get("tickets/:id")
  @Permissions("operations.view")
  getTicket(@Param("id") id: string) {
    return this.tickets.findOne(id).then((data) => ({ data, message: "Support ticket" }));
  }

  @Post("tickets")
  @Permissions("support.create")
  createTicket(@Body() body: CreateSupportTicketDto) {
    return this.tickets.create(body).then((data) => ({ data, message: "Support ticket created" }));
  }

  @Patch("tickets/:id")
  @Permissions("support.manage")
  updateTicket(@Param("id") id: string, @Body() body: UpdateSupportTicketDto) {
    return this.tickets.update(id, body).then((data) => ({ data, message: "Support ticket updated" }));
  }

  @Post("tickets/:id/acknowledge")
  @Permissions("support.manage")
  acknowledge(@Param("id") id: string) {
    return this.tickets.acknowledge(id).then((data) => ({ data, message: "Ticket acknowledged" }));
  }

  @Post("tickets/:id/assign")
  @Permissions("support.manage")
  assign(@Param("id") id: string, @Body() body: AssignTicketDto) {
    return this.tickets.assign(id, body).then((data) => ({ data, message: "Ticket assigned" }));
  }

  @Post("tickets/:id/status")
  @Permissions("support.manage")
  changeStatus(@Param("id") id: string, @Body() body: TicketStatusDto) {
    return this.tickets.changeStatus(id, body).then((data) => ({ data, message: "Ticket status updated" }));
  }

  @Post("tickets/:id/resolve")
  @Permissions("support.manage")
  resolve(@Param("id") id: string, @Body() body: ResolveTicketDto) {
    return this.tickets.resolve(id, body).then((data) => ({ data, message: "Ticket resolved" }));
  }

  @Post("tickets/:id/close")
  @Permissions("support.manage")
  close(@Param("id") id: string, @Body() body: CloseTicketDto) {
    return this.tickets.close(id, body).then((data) => ({ data, message: "Ticket closed" }));
  }

  @Post("tickets/:id/reopen")
  @Permissions("support.manage")
  reopen(@Param("id") id: string, @Body() body: ReopenTicketDto) {
    return this.tickets.reopen(id, body).then((data) => ({ data, message: "Ticket reopened" }));
  }

  @Get("sla/dashboard")
  @Permissions("operations.view")
  slaDashboard() {
    return this.tickets.getSlaDashboard().then((data) => ({ data, message: "SLA dashboard" }));
  }

  @Get("sla/breaches")
  @Permissions("operations.view")
  slaBreaches() {
    return this.tickets.getSlaBreaches().then((data) => ({ data, message: "SLA breaches" }));
  }

  @Post("sla/recalculate")
  @Permissions("support.manage")
  recalculateSla() {
    return this.tickets.recalculateSlaBreaches().then((data) => ({ data, message: "SLA recalculated" }));
  }

  @Get("escalation-matrix")
  @Permissions("operations.view")
  escalationMatrix() {
    return this.tickets.listEscalationMatrix().then((data) => ({ data, message: "Escalation matrix" }));
  }

  @Post("escalation-matrix")
  @Permissions("support.manage")
  createEscalation(@Body() body: CreateEscalationRuleDto) {
    return this.tickets.createEscalationRule(body).then((data) => ({ data, message: "Escalation rule created" }));
  }

  @Patch("escalation-matrix/:id")
  @Permissions("support.manage")
  updateEscalation(@Param("id") id: string, @Body() body: UpdateEscalationRuleDto) {
    return this.tickets.updateEscalationRule(id, body).then((data) => ({ data, message: "Escalation rule updated" }));
  }
}

@ApiTags("Releases")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("releases")
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  @Permissions("operations.view")
  list(@Query() query: OperationsListQueryDto) {
    return this.releases.findAll(query).then((r) => ({ data: r.items, meta: r.meta, message: "Releases" }));
  }

  @Get(":id")
  @Permissions("operations.view")
  getOne(@Param("id") id: string) {
    return this.releases.findOne(id).then((data) => ({ data, message: "Release" }));
  }

  @Post()
  @Permissions("release.manage")
  create(@Body() body: CreateReleaseDto) {
    return this.releases.create(body).then((data) => ({ data, message: "Release created" }));
  }

  @Patch(":id")
  @Permissions("release.manage")
  update(@Param("id") id: string, @Body() body: UpdateReleaseDto) {
    return this.releases.update(id, body).then((data) => ({ data, message: "Release updated" }));
  }

  @Post(":id/schedule")
  @Permissions("release.manage")
  schedule(@Param("id") id: string) {
    return this.releases.schedule(id).then((data) => ({ data, message: "Release scheduled" }));
  }

  @Post(":id/mark-deployed")
  @Permissions("release.manage")
  markDeployed(@Param("id") id: string, @Body() body: MarkDeployedDto) {
    return this.releases.markDeployed(id, body).then((data) => ({ data, message: "Release deployed" }));
  }

  @Post(":id/rollback")
  @Permissions("release.manage")
  rollback(@Param("id") id: string, @Body() body: RollbackReleaseDto) {
    return this.releases.rollback(id, body).then((data) => ({ data, message: "Release rolled back" }));
  }
}
