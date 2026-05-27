import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import { ReplicationSyncService } from "./replication-sync.service";

@Global()
@Module({
  providers: [PrismaService, ReplicationSyncService],
  exports: [PrismaService, ReplicationSyncService]
})
export class PrismaModule {}
