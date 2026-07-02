import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { WorkforceModule } from "../workforce/workforce.module";
import { PeopleController } from "./people.controller";
import { PeopleService } from "./people.service";
import { TechniciansService } from "./technicians.service";
import { UserInvitationService } from "./user-invitation.service";

@Module({
  imports: [WorkforceModule, NotificationsModule],
  controllers: [PeopleController],
  providers: [PeopleService, TechniciansService, UserInvitationService],
  exports: [PeopleService, TechniciansService, UserInvitationService]
})
export class PeopleModule {}
