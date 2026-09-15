import { Module, forwardRef } from "@nestjs/common";

import { QrCodeService } from "../../common/services/qr-code.service";
import { ApprovalsModule } from "../approvals/approvals.module";
import { AssetTaxonomyModule } from "../asset-taxonomy/asset-taxonomy.module";
import { AssetRegistryService } from "./asset-registry.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  imports: [AssetTaxonomyModule, forwardRef(() => ApprovalsModule)],
  controllers: [AssetsController],
  providers: [AssetsService, AssetRegistryService, QrCodeService],
  exports: [AssetsService, AssetRegistryService]
})
export class AssetsModule {}
