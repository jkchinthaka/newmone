import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class PredictiveAiService {
  constructor(private readonly prisma: PrismaService) {}

  logs() {
    return this.prisma.predictiveLog.findMany({
      include: {
        asset: true
      },
      orderBy: { analyzedAt: "desc" }
    });
  }
}
