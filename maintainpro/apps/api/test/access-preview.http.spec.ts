import "reflect-metadata";
import { All, Controller, Get, INestApplication, Req, UseGuards } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { AccessPreviewGuard } from "../src/common/guards/access-preview.guard";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { JwtStrategy } from "../src/modules/auth/jwt.strategy";
import { PrismaService } from "../src/database/prisma.service";
import { setAccessStudioRuntimeAllowed } from "../src/common/auth/effective-permissions";

const mutation = jest.fn(() => ({ changed: true }));
@Controller("preview-test")
@UseGuards(JwtAuthGuard)
class PreviewTestController {
  @Get("identity") identity(@Req() req: any) { return req.user; }
  @All("mutation") write() { return mutation(); }
}

describe("read-only request preview with real Passport JWT", () => {
  let app: INestApplication;
  const previous = process.env.ACCESS_STUDIO_ENABLED;
  const secret = "preview-http-test-secret-not-for-production";
  let targetRole = "TECHNICIAN";
  const targetRead = jest.fn(async ({ where }) => where.id === "target" && where.tenantId === "tenant-a"
    ? { id: "target", tenantId: "tenant-a", email: "target@example.invalid", lockedUntil: null, role: { name: targetRole } } : null);
  const token = (role: string) => sign({ sub: role === "SUPER_ADMIN" ? "admin" : "caller", email: "caller@example.invalid", role, tenantId: "tenant-a" }, secret, { expiresIn: "5m" });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [PreviewTestController], providers: [
      JwtStrategy, JwtAuthGuard, Reflector,
      { provide: ConfigService, useValue: { get: () => secret } },
      { provide: PrismaService, useValue: { user: {
        findUnique: async ({ where }: any) => ({ isActive: true, tenantId: "tenant-a", role: { name: where.id === "admin" ? "SUPER_ADMIN" : "TECHNICIAN" } }),
        findFirst: targetRead
      } } }
    ] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalGuards(new AccessPreviewGuard(), module.get(JwtAuthGuard));
    await app.init();
  });
  beforeEach(() => { process.env.ACCESS_STUDIO_ENABLED = "true"; setAccessStudioRuntimeAllowed(true); targetRole = "TECHNICIAN"; mutation.mockClear(); targetRead.mockClear(); });
  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED; else process.env.ACCESS_STUDIO_ENABLED = previous;
    setAccessStudioRuntimeAllowed(true);
  });
  it("uses the target identity through repeated global/controller JWT guards without issuing a token", async () => {
    const result = await request(app.getHttpServer()).get("/api/preview-test/identity")
      .auth(token("SUPER_ADMIN"), { type: "bearer" }).set("x-access-preview-user", "target");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ sub: "target", role: "TECHNICIAN", tenantId: "tenant-a" });
    expect(result.body.accessToken).toBeUndefined();
    expect(result.body.refreshToken).toBeUndefined();
    expect(result.headers["set-cookie"]).toBeUndefined();
  });
  it.each(["post", "put", "patch", "delete"])("rejects %s before mutation handling", async (method) => {
    const result = await (request(app.getHttpServer()) as any)[method]("/api/preview-test/mutation")
      .auth(token("SUPER_ADMIN"), { type: "bearer" }).set("x-access-preview-user", "target").send({});
    expect(result.status).toBe(403);
    expect(result.body.message).toMatch(/read-only/);
    expect(mutation).not.toHaveBeenCalled();
  });
  it("rejects non-super-admin callers even with a forged JWT role", async () => {
    const forgedRole = sign({ sub: "caller", email: "caller@example.invalid", role: "SUPER_ADMIN", tenantId: "tenant-a" }, secret);
    const result = await request(app.getHttpServer()).get("/api/preview-test/identity")
      .auth(forgedRole, { type: "bearer" }).set("x-access-preview-user", "target");
    expect(result.status).toBe(403);
    expect(targetRead).not.toHaveBeenCalled();
  });
  it("rejects other-tenant and super-admin targets", async () => {
    const read = () => request(app.getHttpServer()).get("/api/preview-test/identity").auth(token("SUPER_ADMIN"), { type: "bearer" });
    expect((await read().set("x-access-preview-user", "other-tenant-user")).status).toBe(404);
    targetRole = "SUPER_ADMIN";
    expect((await read().set("x-access-preview-user", "target")).status).toBe(403);
  });
  it("blocks preview mutations before authentication and fails closed when startup parity disables the runtime", async () => {
    expect((await request(app.getHttpServer()).post("/api/preview-test/mutation").set("x-access-preview-user", "target")).status).toBe(403);
    setAccessStudioRuntimeAllowed(false);
    expect((await request(app.getHttpServer()).get("/api/preview-test/identity").auth(token("SUPER_ADMIN"), { type: "bearer" }).set("x-access-preview-user", "target")).status).toBe(403);
    expect(mutation).not.toHaveBeenCalled();
    expect(targetRead).not.toHaveBeenCalled();
  });
  it("fails closed for a stale preview after flag disable; ordinary OFF requests retain develop behavior", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "false";
    const result = await request(app.getHttpServer()).get("/api/preview-test/identity").auth(token("SUPER_ADMIN"), { type: "bearer" }).set("x-access-preview-user", "target");
    expect(result.status).toBe(403);
    expect(targetRead).not.toHaveBeenCalled();
    expect((await request(app.getHttpServer()).post("/api/preview-test/mutation").auth(token("SUPER_ADMIN"), { type: "bearer" }).set("x-access-preview-user", "target")).status).toBe(403);
    expect(mutation).not.toHaveBeenCalled();
    const ordinary = await request(app.getHttpServer()).get("/api/preview-test/identity").auth(token("SUPER_ADMIN"), { type: "bearer" });
    expect(ordinary.body.sub).toBe("admin");
    expect((await request(app.getHttpServer()).post("/api/preview-test/mutation").auth(token("SUPER_ADMIN"), { type: "bearer" })).status).toBe(200);
    expect(mutation).toHaveBeenCalledTimes(1);
  });
});
