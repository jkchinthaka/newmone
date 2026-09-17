import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { NumberingService } from "./numbering.service";

@Module({
  imports: [PrismaModule],
  providers: [NumberingService],
  exports: [NumberingService]
})
export class NumberingModule {}
