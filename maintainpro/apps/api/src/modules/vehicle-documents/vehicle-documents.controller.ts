import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { VehicleDocumentType } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { VehicleDocumentsService } from "./vehicle-documents.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Vehicle Documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class VehicleDocumentsController {
  constructor(private readonly service: VehicleDocumentsService) {}

  @Get("vehicles/:vehicleId/documents")
  @Permissions("vehicle_documents.view")
  async list(@Req() req: AuthedRequest, @Param("vehicleId") vehicleId: string) {
    const data = await this.service.list(vehicleId, req.user);
    return { data, message: "Vehicle documents fetched" };
  }

  @Post("vehicles/:vehicleId/documents")
  @Permissions("vehicle_documents.manage")
  async create(
    @Req() req: AuthedRequest,
    @Param("vehicleId") vehicleId: string,
    @Body()
    body: {
      documentType: VehicleDocumentType;
      documentNumber?: string;
      issuedDate?: string;
      expiryDate: string;
      issuingAuthority?: string;
      fileUrl?: string;
      notes?: string;
    }
  ) {
    const data = await this.service.create({ ...body, vehicleId }, req.user);
    return { data, message: "Vehicle document uploaded" };
  }

  @Get("vehicle-documents/:id")
  @Permissions("vehicle_documents.view")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.findOne(id, req.user);
    return { data, message: "Vehicle document fetched" };
  }

  @Patch("vehicle-documents/:id")
  @Permissions("vehicle_documents.manage")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      documentNumber?: string;
      issuedDate?: string;
      expiryDate?: string;
      issuingAuthority?: string;
      fileUrl?: string;
      notes?: string;
    }
  ) {
    const data = await this.service.update(id, body, req.user);
    return { data, message: "Vehicle document updated" };
  }

  @Post("vehicle-documents/:id/verify")
  @Permissions("vehicle_documents.verify")
  async verify(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.verify(id, req.user);
    return { data, message: "Vehicle document verified" };
  }

  @Post("vehicle-documents/:id/reject")
  @Permissions("vehicle_documents.verify")
  async reject(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { reason: string }) {
    const data = await this.service.reject(id, body?.reason ?? "", req.user);
    return { data, message: "Vehicle document rejected" };
  }

  @Delete("vehicle-documents/:id")
  @Permissions("vehicle_documents.manage")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.remove(id, req.user);
    return { data, message: "Vehicle document deleted" };
  }
}
