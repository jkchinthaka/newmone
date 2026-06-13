import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { AdminAccessController } from "./admin-access.controller";

@Module({
  imports: [UsersModule],
  controllers: [AdminAccessController]
})
export class AdminModule {}
