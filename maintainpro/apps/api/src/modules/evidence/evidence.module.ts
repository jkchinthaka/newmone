import { Module } from "@nestjs/common";

import { EvidenceController } from "./evidence.controller";
import { EvidenceStorageProviderService } from "./evidence-storage-provider.service";
import { EvidenceService } from "./evidence.service";

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceStorageProviderService, EvidenceService],
  exports: [EvidenceService, EvidenceStorageProviderService]
})
export class EvidenceModule {}
