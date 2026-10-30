import { Module } from "@nestjs/common";

import { EvidenceController } from "./evidence.controller";
import { EvidenceStorageProviderService } from "./evidence-storage-provider.service";
import { EvidenceService } from "./evidence.service";
import { ProofPhotoController } from "./proof-photo.controller";
import { ProofPhotoService } from "./proof-photo.service";

@Module({
  controllers: [EvidenceController, ProofPhotoController],
  providers: [EvidenceStorageProviderService, EvidenceService, ProofPhotoService],
  exports: [EvidenceService, EvidenceStorageProviderService, ProofPhotoService]
})
export class EvidenceModule {}
