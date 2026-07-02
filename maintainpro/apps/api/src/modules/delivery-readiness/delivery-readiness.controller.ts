import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CreateDeliveryChecklistDto,
  CreateDeliveryItemDto,
  DeliveryAcceptRiskDto,
  DeliveryCompleteItemDto,
  DeliveryFailItemDto,
  DeliveryListQueryDto,
  DeliverySignOffDto,
  UpdateDeliveryChecklistDto,
  UpdateDeliveryItemDto
} from "./dto/delivery.dto";
import { DeliveryReadinessService } from "./delivery-readiness.service";

@ApiTags("Delivery Readiness")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("delivery-readiness")
export class DeliveryReadinessController {
  constructor(private readonly service: DeliveryReadinessService) {}

  @Get("dashboard")
  @Permissions("delivery.view")
  getDashboard() {
    return this.service.getDashboard().then((data) => ({ data, message: "Delivery readiness dashboard" }));
  }

  @Get("categories")
  @Permissions("delivery.view")
  getCategories() {
    return { data: this.service.getCategories(), message: "Delivery categories fetched" };
  }

  @Get("checklists")
  @Permissions("delivery.view")
  listChecklists(@Query() query: DeliveryListQueryDto) {
    return this.service.findAllChecklists(query).then((result) => ({
      data: result.items,
      meta: result.meta,
      message: "Delivery checklists fetched"
    }));
  }

  @Get("items")
  @Permissions("delivery.view")
  listItems(@Query() query: DeliveryListQueryDto) {
    return this.service.listItems(query).then((result) => ({
      data: result.items,
      meta: result.meta,
      message: "Delivery checklist items fetched"
    }));
  }

  @Get("checklists/:id")
  @Permissions("delivery.view")
  getChecklist(@Param("id") id: string) {
    return this.service.findOneChecklist(id).then((data) => ({ data, message: "Delivery checklist fetched" }));
  }

  @Post("checklists")
  @Permissions("delivery.manage")
  createChecklist(@Body() body: CreateDeliveryChecklistDto) {
    return this.service.createChecklist(body).then((data) => ({ data, message: "Delivery checklist created" }));
  }

  @Patch("checklists/:id")
  @Permissions("delivery.manage")
  updateChecklist(@Param("id") id: string, @Body() body: UpdateDeliveryChecklistDto) {
    return this.service.updateChecklist(id, body).then((data) => ({ data, message: "Delivery checklist updated" }));
  }

  @Post("checklists/:id/items")
  @Permissions("delivery.manage")
  addItem(@Param("id") id: string, @Body() body: CreateDeliveryItemDto) {
    return this.service.addItem(id, body).then((data) => ({ data, message: "Checklist item added" }));
  }

  @Patch("items/:id")
  @Permissions("delivery.manage")
  updateItem(@Param("id") id: string, @Body() body: UpdateDeliveryItemDto) {
    return this.service.updateItem(id, body).then((data) => ({ data, message: "Checklist item updated" }));
  }

  @Post("items/:id/complete")
  @Permissions("delivery.manage")
  completeItem(@Param("id") id: string, @Body() body: DeliveryCompleteItemDto) {
    return this.service.completeItem(id, body).then((data) => ({ data, message: "Checklist item marked PASS" }));
  }

  @Post("items/:id/fail")
  @Permissions("delivery.manage")
  failItem(@Param("id") id: string, @Body() body: DeliveryFailItemDto) {
    return this.service.failItem(id, body).then((data) => ({ data, message: "Checklist item marked FAIL/BLOCKED" }));
  }

  @Post("items/:id/accept-risk")
  @Permissions("delivery.accept_risk")
  acceptRisk(@Param("id") id: string, @Body() body: DeliveryAcceptRiskDto) {
    return this.service.acceptRisk(id, body).then((data) => ({ data, message: "Delivery risk accepted" }));
  }

  @Get("final-report")
  @Permissions("delivery.view")
  finalReport() {
    return this.service.getFinalReport().then((data) => ({ data, message: "Final delivery readiness report" }));
  }

  @Post("sign-off")
  @Permissions("delivery.sign_off")
  signOff(@Body() body: DeliverySignOffDto) {
    return this.service.signOff(body).then((data) => ({ data, message: "Delivery sign-off recorded" }));
  }

  @Get("export")
  @Permissions("delivery.export")
  exportReport() {
    return this.service.exportReport().then((data) => ({ data, message: "Delivery readiness report exported" }));
  }
}
