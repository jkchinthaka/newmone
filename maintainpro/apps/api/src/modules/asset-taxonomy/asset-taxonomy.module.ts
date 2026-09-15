import { Module } from "@nestjs/common";

import { AssetTaxonomyController } from "./asset-taxonomy.controller";
import { AssetTaxonomyService } from "./asset-taxonomy.service";

@Module({
  controllers: [AssetTaxonomyController],
  providers: [AssetTaxonomyService],
  exports: [AssetTaxonomyService]
})
export class AssetTaxonomyModule {}
