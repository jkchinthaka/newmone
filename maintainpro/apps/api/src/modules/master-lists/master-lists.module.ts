import { Module } from "@nestjs/common";

import { MasterListsController } from "./master-lists.controller";
import { MasterListsService } from "./master-lists.service";

@Module({
  controllers: [MasterListsController],
  providers: [MasterListsService],
  exports: [MasterListsService]
})
export class MasterListsModule {}
