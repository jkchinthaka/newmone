import { Module } from "@nestjs/common";

import { FacilityHierarchyMigrationService } from "./facility-hierarchy-migration.service";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";
import { PlacesImportService } from "./places-import.service";

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, FacilityHierarchyMigrationService, PlacesImportService],
  exports: [OrganizationService, FacilityHierarchyMigrationService]
})
export class OrganizationModule {}
