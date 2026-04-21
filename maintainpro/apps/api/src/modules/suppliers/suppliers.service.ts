import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });
  }

  findOne(id: string) {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  create(data: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    taxNumber?: string;
    notes?: string;
  }) {
    return this.prisma.supplier.create({ data });
  }

  update(
    id: string,
    data: Partial<{ name: string; contactName: string; email: string; phone: string; address: string; website: string; taxNumber: string; notes: string; isActive: boolean }>
  ) {
    return this.prisma.supplier.update({ where: { id }, data });
  }
}
