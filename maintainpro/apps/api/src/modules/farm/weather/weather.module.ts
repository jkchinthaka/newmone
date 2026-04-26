import {
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";
import { FarmCacheService } from "../farm-cache.service";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const WEATHER_LIST_TTL_MS = 60 * 60 * 1000; // 1h
const WEATHER_ALERTS_TTL_MS = 30 * 60 * 1000; // 30m

@Injectable()
export class WeatherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeatherService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: FarmCacheService
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    // Light interval-based scheduler since @nestjs/schedule isn't installed.
    this.timer = setInterval(() => {
      this.pollOpenWeather().catch((err) => this.logger.error(`weather poll failed: ${err.message}`));
    }, SIX_HOURS_MS);
    if (this.timer.unref) this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  list(tenantId?: string, limit = 100) {
    const cap = Math.min(limit, 500);
    return this.cache.wrap(
      `weather:list:${tenantId ?? "_"}:${cap}`,
      WEATHER_LIST_TTL_MS,
      () =>
        this.prisma.weatherLog.findMany({
          where: { tenantId: tenantId ?? undefined },
          orderBy: { recordedAt: "desc" },
          take: cap
        })
    );
  }

  alerts(tenantId?: string) {
    return this.cache.wrap(
      `weather:alerts:${tenantId ?? "_"}`,
      WEATHER_ALERTS_TTL_MS,
      () =>
        this.prisma.weatherLog.findMany({
          where: { tenantId: tenantId ?? undefined, alertTriggered: true },
          orderBy: { recordedAt: "desc" },
          take: 50
        })
    );
  }

  async manualEntry(input: {
    tenantId: string;
    temperatureC?: number;
    rainfallMm?: number;
    humidityPct?: number;
    windSpeedKmh?: number;
    condition?: string;
    recordedAt?: string;
  }) {
    const { alert, alertType } = this.evaluateAlert(input.temperatureC, input.rainfallMm);
    this.cache.invalidate(`weather:`);
    return this.prisma.weatherLog.create({
      data: {
        tenantId: input.tenantId,
        recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
        temperatureC: input.temperatureC,
        rainfallMm: input.rainfallMm,
        humidityPct: input.humidityPct,
        windSpeedKmh: input.windSpeedKmh,
        condition: input.condition,
        source: "MANUAL",
        alertTriggered: alert,
        alertType
      }
    });
  }

  private evaluateAlert(tempC?: number | null, rainMm?: number | null) {
    const frost = Number(this.config.get("WEATHER_ALERT_FROST_THRESHOLD_C") ?? 5);
    const rainTh = Number(this.config.get("WEATHER_ALERT_RAIN_THRESHOLD_MM") ?? 50);
    if (tempC !== undefined && tempC !== null && tempC <= frost) {
      return { alert: true, alertType: "FROST_WARNING" };
    }
    if (rainMm !== undefined && rainMm !== null && rainMm >= rainTh) {
      return { alert: true, alertType: "HEAVY_RAIN_ALERT" };
    }
    return { alert: false, alertType: null };
  }

  async pollOpenWeather() {
    const apiKey = this.config.get<string>("OPENWEATHER_API_KEY");
    if (!apiKey) {
      this.logger.debug("OPENWEATHER_API_KEY not set; skipping poll");
      return { polled: 0 };
    }

    const lat = Number(this.config.get("FARM_DEFAULT_LATITUDE") ?? 6.9271);
    const lon = Number(this.config.get("FARM_DEFAULT_LONGITUDE") ?? 79.8612);

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OpenWeather HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      main?: { temp?: number; humidity?: number };
      wind?: { speed?: number };
      weather?: Array<{ description?: string }>;
      rain?: { "1h"?: number; "3h"?: number };
    };

    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    const tempC = json.main?.temp;
    const humidity = json.main?.humidity;
    const windKmh = json.wind?.speed ? json.wind.speed * 3.6 : undefined;
    const rainMm = json.rain?.["1h"] ?? json.rain?.["3h"];
    const condition = json.weather?.[0]?.description;
    const { alert, alertType } = this.evaluateAlert(tempC, rainMm);

    let count = 0;
    for (const t of tenants) {
      await this.prisma.weatherLog.create({
        data: {
          tenantId: t.id,
          recordedAt: new Date(),
          temperatureC: tempC,
          rainfallMm: rainMm,
          humidityPct: humidity,
          windSpeedKmh: windKmh,
          condition,
          source: "OPENWEATHER_API",
          alertTriggered: alert,
          alertType
        }
      });
      count += 1;
    }
    this.cache.invalidate(`weather:`);
    return { polled: count };
  }
}

@ApiTags("Farm / Weather")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/weather")
export class WeatherController {
  constructor(private readonly service: WeatherService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async list(@Query("tenantId") tenantId?: string, @Query("limit") limitRaw?: string) {
    const data = await this.service.list(tenantId, limitRaw ? Number(limitRaw) : 100);
    return { data, message: "Weather logs fetched" };
  }

  @Get("alerts")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async alerts(@Query("tenantId") tenantId?: string) {
    const data = await this.service.alerts(tenantId);
    return { data, message: "Weather alerts fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async record(@Body() body: Parameters<WeatherService["manualEntry"]>[0]) {
    const data = await this.service.manualEntry(body);
    return { data, message: "Weather log recorded" };
  }

  @Post("poll")
  @Roles("SUPER_ADMIN", "ADMIN")
  async poll() {
    const data = await this.service.pollOpenWeather();
    return { data, message: "Weather poll triggered" };
  }
}

@Module({
  controllers: [WeatherController],
  providers: [WeatherService, FarmCacheService],
  exports: [WeatherService]
})
export class WeatherModule {}
