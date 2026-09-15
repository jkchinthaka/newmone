import { Module } from "@nestjs/common";

import { FacilityHierarchyMigrationService } from "./facility-hierarchy-migration.service";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, FacilityHierarchyMigrationService],
  exports: [OrganizationService, FacilityHierarchyMigrationService]
})
export class OrganizationModule {}
