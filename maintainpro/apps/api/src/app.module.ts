import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ConfigModule } from "@nestjs/config";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { RequestContextMiddleware } from "./common/context/request-context.middleware";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { envValidationSchema } from "./config/env.validation";
import { MongoSyncService } from "./database/mongo-sync.service";
import { PrismaModule } from "./database/prisma.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { CleaningModule } from "./modules/cleaning/cleaning.module";
import { DriversModule } from "./modules/drivers/drivers.module";
import { CropsModule } from "./modules/farm/crops/crops.module";
import { FarmFinanceModule } from "./modules/farm/farm-finance/farm-finance.module";
import { FarmWorkersModule } from "./modules/farm/farm-workers/farm-workers.module";
import { FieldsModule } from "./modules/farm/fields/fields.module";
import { HarvestModule } from "./modules/farm/harvest/harvest.module";
import { IrrigationModule } from "./modules/farm/irrigation/irrigation.module";
import { LivestockModule } from "./modules/farm/livestock/livestock.module";
import { SoilTestsModule } from "./modules/farm/soil-tests/soil-tests.module";
import { SprayLogsModule } from "./modules/farm/spray-logs/spray-logs.module";
import { TraceabilityModule } from "./modules/farm/traceability/traceability.module";
import { WeatherModule } from "./modules/farm/weather/weather.module";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module";
import { FleetModule } from "./modules/fleet/fleet.module";
import { FuelModule } from "./modules/fuel/fuel.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { InvitationsModule } from "./modules/invitations/invitations.module";
import { JobCodesModule } from "./modules/job-codes/job-codes.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PredictiveAiModule } from "./modules/predictive-ai/predictive-ai.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
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
            password: redisUrl.password || undefined,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            enableReadyCheck: false,
            lazyConnect: true,
            retryStrategy: (times: number) => Math.min(times * 5000, 30000)
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
    AuditModule,
    VehiclesModule,
    FleetModule,
    DriversModule,
    MaintenanceModule,
    JobCodesModule,
    WorkOrdersModule,
    InventoryModule,
    DepartmentsModule,
    SuppliersModule,
    FuelModule,
    TripsModule,
    NotificationsModule,
    SettingsModule,
    ReportsModule,
    UtilitiesModule,
    PredictiveAiModule,
    CleaningModule,
    FieldsModule,
    CropsModule,
    HarvestModule,
    LivestockModule,
    IrrigationModule,
    SprayLogsModule,
    WeatherModule,
    SoilTestsModule,
    FarmWorkersModule,
    FarmFinanceModule,
    TraceabilityModule
  ],
  providers: [
    HealthService,
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
      .apply(TenantContextMiddleware, RequestContextMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
