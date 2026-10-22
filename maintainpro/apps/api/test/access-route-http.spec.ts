import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import request from "supertest";
import inventory from "../src/database/access-route-inventory.json";
import { accessKeyForMethodPath, accessKeyForRequest } from "../src/common/auth/access-route-keys";
import { setAccessStudioRuntimeAllowed } from "../src/common/auth/effective-permissions";
import { oldAccessDecision } from "../src/common/auth/access-studio-parity";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { PermissionsGuard, hasCompatiblePermission } from "../src/common/guards/permissions.guard";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { PrismaService } from "../src/database/prisma.service";
import { AssetsController } from "../src/modules/assets/assets.controller";
import { AssetsService } from "../src/modules/assets/assets.service";
import { CropsController, CropsService } from "../src/modules/farm/crops/crops.module";
import { PredictiveAiController } from "../src/modules/predictive-ai/predictive-ai.controller";
import { PredictiveAiService } from "../src/modules/predictive-ai/predictive-ai.service";

// Use production controllers and routing metadata; stub only identity and service I/O.
const cases = [
  { method: "GET", path: "/assets/:id", url: "/assets/asset-1" },
  { method: "GET", path: "/assets/:id/movements", url: "/assets/asset-1/movements" },
  { method: "GET", path: "/ai/field-insights", url: "/ai/field-insights" },
  { method: "GET", path: "/predictive-ai/field-insights", url: "/predictive-ai/field-insights" },
  { method: "GET", path: "/farm/crops/:id", url: "/farm/crops/crop-1" },
  { method: "POST", path: "/farm/crops", url: "/farm/crops" },
  { method: "DELETE", path: "/farm/crops/:id", url: "/farm/crops/crop-1" }
];

describe("Studio route keys through Nest HTTP with /api prefix", () => {
  let app: INestApplication;
  let role = "CLEANER";
  let keys: string[] = [];
  let overrides: Array<{ permissionKey: string; effect: string }> = [];
  let resolved: string | undefined;
  const previous = process.env.ACCESS_STUDIO_ENABLED;
  const handler = jest.fn(async () => ({ reached: true }));
  const overrideRead = jest.fn(async () => overrides);
  const prisma = {
    user: { findUnique: async () => ({ id: "user-1", tenantId: "tenant-1", isActive: true,
      lockedUntil: null, role: { name: role, permissionLinks: keys.map((key) => ({ permission: { key } })) } }) },
    tenant: { findUnique: async () => ({ accessConfigVersion: 2 }) },
    userPermissionOverride: { findMany: overrideRead }
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AssetsController, CropsController, PredictiveAiController],
      providers: [
        { provide: AssetsService, useValue: { findOne: handler, listMovementHistory: handler } },
        { provide: CropsService, useValue: { get: handler, create: handler, remove: handler } },
        { provide: PredictiveAiService, useValue: { getFieldInsights: handler } }
      ]
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { sub: "user-1", role, tenantId: "tenant-1", email: "test@example.invalid" };
      next();
    });
    const reflector = new Reflector();
    app.useGlobalGuards(
      { canActivate: (ctx) => { resolved = accessKeyForRequest(ctx.switchToHttp().getRequest()); return true; } },
      new RolesGuard(reflector, prisma as unknown as PrismaService),
      new PermissionsGuard(reflector, prisma as unknown as PrismaService)
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED;
    else process.env.ACCESS_STUDIO_ENABLED = previous;
    setAccessStudioRuntimeAllowed(true);
  });

  for (const item of cases) {
    it(`${item.method} ${item.path}: real route key, GRANT, DENY and develop parity`, async () => {
      const route = inventory.routes.find((r) => r.method === item.method && r.path === item.path);
      expect(route).toBeDefined();
      const key = accessKeyForMethodPath(item.method, item.path)!;
      expect(key).toBeDefined();
      role = "CLEANER";
      expect(route!.roles).not.toContain(role);
      keys = [...route!.permissions];
      overrides = [{ permissionKey: key, effect: "GRANT" }];
      process.env.ACCESS_STUDIO_ENABLED = "true";
      setAccessStudioRuntimeAllowed(true);
      const send = () => (request(app.getHttpServer()) as any)[item.method.toLowerCase()](`/api${item.url}`).send({});
      handler.mockClear();
      const granted = await send();
      expect(resolved).toBe(key);
      expect(granted.status).toBe(item.method === "POST" ? 201 : 200);
      expect(handler).toHaveBeenCalledTimes(1);
      overrides = [];
      handler.mockClear();
      expect((await send()).status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
      if (route!.permissions.length) {
        overrides = [{ permissionKey: key, effect: "GRANT" }];
        keys = [];
        expect((await send()).status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
        keys = [...route!.permissions];
      }
      overrides = [{ permissionKey: key, effect: "DENY" }];
      handler.mockClear();
      expect((await send()).status).toBe(403);
      expect(handler).not.toHaveBeenCalled();

      process.env.ACCESS_STUDIO_ENABLED = "false";
      for (const candidate of ["CLEANER", "ADMIN", "SUPER_ADMIN"]) {
        role = candidate;
        overrideRead.mockClear();
        const expected = oldAccessDecision(route!, role, new Set(keys), hasCompatiblePermission);
        const result = await send();
        expect(result.status).toBe(expected ? (item.method === "POST" ? 201 : 200) : 403);
        expect(overrideRead).not.toHaveBeenCalled();
      }
    });
  }
});
