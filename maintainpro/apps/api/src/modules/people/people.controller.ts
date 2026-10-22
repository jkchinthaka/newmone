import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CreatePersonDto,
  EnableLoginDto,
  InviteMethod,
  PeopleListQueryDto,
  UpdatePersonDto,
  UpdateTechnicianProfileDto
} from "./dto/people.dto";
import { PeopleService } from "./people.service";
import { TechniciansService } from "./technicians.service";

@ApiTags("People")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PeopleController {
  constructor(
    private readonly peopleService: PeopleService,
    private readonly techniciansService: TechniciansService
  ) {}

  @Get("people")
  @Permissions("users.view")
  async listPeople(@Query() query: PeopleListQueryDto) {
    const result = await this.peopleService.findAll(query);
    return { data: result.items, meta: result.meta, message: "People fetched" };
  }

  @Get("people/:id")
  @Permissions("users.view")
  async getPerson(@Param("id") id: string) {
    const person = await this.peopleService.findOne(id);
    return { data: person, message: "Person fetched" };
  }

  @Post("people")
  @Permissions("users.create")
  async createPerson(@Body() body: CreatePersonDto) {
    const result = await this.peopleService.create(body);
    return { data: result, message: "Person created" };
  }

  @Patch("people/:id")
  @Permissions("users.edit")
  async updatePerson(@Param("id") id: string, @Body() body: UpdatePersonDto) {
    const person = await this.peopleService.update(id, body);
    return { data: person, message: "Person updated" };
  }

  @Post("people/:id/deactivate")
  @Permissions("users.status.manage")
  async deactivatePerson(@Param("id") id: string) {
    const person = await this.peopleService.deactivate(id);
    return { data: person, message: "Person deactivated" };
  }

  @Post("people/:id/reactivate")
  @Permissions("users.status.manage")
  async reactivatePerson(@Param("id") id: string) {
    const person = await this.peopleService.reactivate(id);
    return { data: person, message: "Person reactivated" };
  }

  @Post("people/:id/technician-profile")
  @Permissions("users.edit")
  async upsertTechnicianProfile(@Param("id") id: string, @Body() body: UpdateTechnicianProfileDto) {
    const profile = await this.peopleService.upsertTechnicianProfile(id, body);
    return { data: profile, message: "Technician profile updated" };
  }

  @Post("people/:id/enable-login")
  @Permissions("users.create")
  async enableLogin(@Param("id") id: string, @Body() body: EnableLoginDto) {
    const result = await this.peopleService.enableLogin(id, body);
    return { data: result, message: "Login enabled" };
  }

  @Post("people/:id/disable-login")
  @Permissions("users.status.manage")
  async disableLogin(@Param("id") id: string) {
    const person = await this.peopleService.disableLogin(id);
    return { data: person, message: "Login disabled" };
  }

  @Get("technicians")
  @Permissions("users.view")
  async listTechnicians(
    @Query("search") search?: string,
    @Query("branchName") branchName?: string,
    @Query("departmentId") departmentId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const result = await this.techniciansService.listAll(null, {
      search,
      branchName,
      departmentId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
    return {
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
      message: "Technicians fetched"
    };
  }

  @Get("technicians/assignable")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async listAssignableTechnicians(@Query("designation") designation?: string) {
    const data = await this.techniciansService.listAssignable(null, designation);
    return { data, message: "Assignable technicians fetched" };
  }

  @Patch("technicians/:id")
  @Permissions("users.edit")
  async updateTechnician(@Param("id") id: string, @Body() body: UpdateTechnicianProfileDto) {
    const profile = await this.peopleService.upsertTechnicianProfile(id, body);
    return { data: profile, message: "Technician updated" };
  }

  @Post("users/:id/reset-password")
  @Permissions("users.edit")
  async resetPassword(
    @Param("id") id: string,
    @Body("inviteMethod") inviteMethod?: InviteMethod
  ) {
    const result = await this.peopleService.resetPassword(id, inviteMethod ?? InviteMethod.TEMP_PASSWORD);
    return { data: result, message: "Password reset issued" };
  }

  @Post("users/:id/send-invite")
  @Permissions("users.create")
  async sendInvite(@Param("id") id: string) {
    const result = await this.peopleService.sendInvite(id);
    return { data: result, message: "Invitation sent" };
  }

  @Post("users/:id/resend-invite")
  @Permissions("users.create")
  async resendInvite(@Param("id") id: string) {
    const result = await this.peopleService.resendInvite(id);
    return { data: result, message: "Invitation resent" };
  }

  @Post("users/:id/revoke-invite")
  @Permissions("users.edit")
  async revokeInvite(@Param("id") id: string) {
    const result = await this.peopleService.revokeInvite(id);
    return { data: result, message: "Invitation revoked" };
  }
}
