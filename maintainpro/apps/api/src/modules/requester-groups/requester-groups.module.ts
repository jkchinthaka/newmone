import { Module } from "@nestjs/common";

import { RequesterGroupsController } from "./requester-groups.controller";
import { RequesterGroupsService } from "./requester-groups.service";

@Module({
  controllers: [RequesterGroupsController],
  providers: [RequesterGroupsService],
  exports: [RequesterGroupsService]
})
export class RequesterGroupsModule {}
