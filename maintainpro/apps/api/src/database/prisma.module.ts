import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import { ReplicationAdminController } from "./replication-admin.controller";
import { ReplicationSyncService } from "./replication-sync.service";

@Global()
@Module({
  controllers: [ReplicationAdminController],
  providers: [PrismaService, ReplicationSyncService],
  exports: [PrismaService, ReplicationSyncService]
})
export class PrismaModule {}
