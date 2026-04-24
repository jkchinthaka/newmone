import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ConfigModule } from "@nestjs/config";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { envValidationSchema } from "./config/env.validation";
import { MongoSyncService } from "./database/mongo-sync.service";
import { PrismaModule } from "./database/prisma.module";
import { HealthController } from "./health.controller";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { CleaningModule } from "./modules/cleaning/cleaning.module";
import { DriversModule } from "./modules/drivers/drivers.module";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module";
import { FleetModule } from "./modules/fleet/fleet.module";
import { FuelModule } from "./modules/fuel/fuel.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { InvitationsModule } from "./modules/invitations/invitations.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PredictiveAiModule } from "./modules/predictive-ai/predictive-ai.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { TenantContextGuard } from "./modules/tenancy/tenant-context.guard";
import { TenantContextMiddleware } from "./modules/tenancy/tenant-context.middleware";
import { TenancyModule } from "./modules/tenancy/tenancy.module";
import { TripsModule } from "./modules/trips/trips.module";
import { UsersModule } from "./modules/users/users.module";
import { UtilitiesModule } from "./modules/utilities/utilities.module";
import { VehiclesModule } from "./modules/vehicles/vehicles.module";
import { WorkOrdersModule } from "./modules/work-orders/work-orders.module";

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.get<string>("REDIS_URL", "redis://localhost:6379"));

        return {
          redis: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            password: redisUrl.password || undefined
          }
        };
      }
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100
      }
    ]),
    PrismaModule,
    AuthModule,
    TenancyModule,
    EntitlementsModule,
    InvitationsModule,
    BillingModule,
    UsersModule,
    RolesModule,
    AssetsModule,
    VehiclesModule,
    FleetModule,
    DriversModule,
    MaintenanceModule,
    WorkOrdersModule,
    InventoryModule,
    SuppliersModule,
    FuelModule,
    TripsModule,
    NotificationsModule,
    SettingsModule,
    ReportsModule,
    UtilitiesModule,
    PredictiveAiModule,
    CleaningModule
  ],
  providers: [
    MongoSyncService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: TenantContextGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
