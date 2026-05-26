import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FinePaymentStatus, FineResponsibility, VehicleDocumentType } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TrafficFinesService } from "./traffic-fines.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Traffic Fines")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("traffic-fines")
export class TrafficFinesController {
  constructor(private readonly service: TrafficFinesService) {}

  @Get()
  @Permissions("traffic_fines.view")
  async list(
    @Req() req: AuthedRequest,
    @Query("vehicleId") vehicleId?: string,
    @Query("driverId") driverId?: string,
    @Query("paymentStatus") paymentStatus?: FinePaymentStatus,
    @Query("responsibility") responsibility?: FineResponsibility
  ) {
    const data = await this.service.list(req.user, { vehicleId, driverId, paymentStatus, responsibility });
    return { data, message: "Traffic fines fetched" };
  }

  @Post()
  @Permissions("traffic_fines.report")
  async create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      vehicleId: string;
      driverId?: string;
      fineDate: string;
      dueDate?: string;
      offense: string;
      violationCode?: string;
      location?: string;
      fineAmount: number;
      responsibility?: FineResponsibility;
      documentRelated?: boolean;
      relatedDocumentType?: VehicleDocumentType;
      issuingAuthority?: string;
      evidenceUrls?: string[];
      notes?: string;
    }
  ) {
    const data = await this.service.create(body, req.user);
    return { data, message: "Traffic fine recorded" };
  }

  @Get(":id")
  @Permissions("traffic_fines.view")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.findOne(id, req.user);
    return { data, message: "Traffic fine fetched" };
  }

  @Post(":id/responsibility")
  @Permissions("traffic_fines.manage")
  async updateResponsibility(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { responsibility: FineResponsibility; reason?: string }
  ) {
    const data = await this.service.updateResponsibility(id, body, req.user);
    return { data, message: "Responsibility updated" };
  }

  @Post(":id/payment")
  @Permissions("traffic_fines.payment")
  async updatePayment(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { status: FinePaymentStatus; paidAmount?: number; paidAt?: string; paymentReference?: string }
  ) {
    const data = await this.service.updatePayment(id, body, req.user);
    return { data, message: "Payment updated" };
  }

  @Post(":id/work-order")
  @Permissions("traffic_fines.manage")
  async linkWorkOrder(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { technicianId?: string; estimatedCost?: number }
  ) {
    const data = await this.service.linkWorkOrder(id, body, req.user);
    return { data, message: "Work order linked to fine" };
  }
}
