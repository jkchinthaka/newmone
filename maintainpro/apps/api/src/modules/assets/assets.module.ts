import { Module, forwardRef } from "@nestjs/common";

import { QrCodeService } from "../../common/services/qr-code.service";
import { ApprovalsModule } from "../approvals/approvals.module";
import { AssetTaxonomyModule } from "../asset-taxonomy/asset-taxonomy.module";
import { EvidenceModule } from "../evidence/evidence.module";
import { AssetRegisterImportController } from "./asset-register-import.controller";
import { AssetRegisterImportService } from "./asset-register-import.service";
import { AssetRegistryService } from "./asset-registry.service";
import { AssetTagImportController } from "./asset-tag-import.controller";
import { AssetTagImportService } from "./asset-tag-import.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  imports: [AssetTaxonomyModule, EvidenceModule, forwardRef(() => ApprovalsModule)],
  controllers: [AssetsController, AssetTagImportController, AssetRegisterImportController],
  providers: [AssetsService, AssetRegistryService, QrCodeService, AssetTagImportService, AssetRegisterImportService],
  exports: [AssetsService, AssetRegistryService]
})
export class AssetsModule {}
