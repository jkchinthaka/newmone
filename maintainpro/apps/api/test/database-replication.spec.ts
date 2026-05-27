import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ReplicationOperation, ReplicationOutboxStatus } from "@prisma/client";

import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { PrismaService } from "../src/database/prisma.service";
import { ReplicationAdminController } from "../src/database/replication-admin.controller";
import { ReplicationSyncService } from "../src/database/replication-sync.service";
import { applyReplicationEventToBackup } from "../src/database/replication.utils";
import { HealthService } from "../src/health.service";

const tenantId = "65f1c4d5e6f7890123456789";

describe("database replication", () => {
  it("creates a durable outbox event after a primary write candidate", async () => {
    const service = Object.create(PrismaService.prototype) as any;
    service.replicationConfig = {
      mode: "async_outbox",
      retryDelayMs: 1000
    };
    service.replicationOutbox = {
      create: jest.fn().mockResolvedValue({ id: "outbox-1" })
    };

    await service.persistReplicationCandidates([
      {
        modelName: "Tenant",
        entityId: tenantId,
        operation: ReplicationOperation.CREATE,
        tenantId,
        actorUserId: null,
        correlationId: "corr-1",
        payload: {
          id: tenantId,
          name: "Nelna",
          slug: "nelna",
          isActive: true
        }
      }
    ]);

    expect(service.replicationOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "Tenant",
          entityId: tenantId,
          operation: ReplicationOperation.CREATE,
          modelName: "Tenant",
          status: "PENDING",
          sourceDatabase: "primary",
          targetDatabase: "backup",
          correlationId: "corr-1",
          payload: expect.objectContaining({ id: tenantId, slug: "nelna" })
        })
      })
    );
  });

  it("blocks strict mode writes when the backup cannot be updated", async () => {
    const service = Object.create(PrismaService.prototype) as any;
    service.backupClient = null;
    service.replicationConfig = {
      retryDelayMs: 1000,
      backupRequiredForStrictMode: true
    };
    service.replicationOutbox = {
      update: jest.fn().mockResolvedValue({})
    };

    await expect(
      service.applyStrictReplication({
        id: "outbox-1",
        modelName: "Tenant",
        entityId: tenantId,
        operation: ReplicationOperation.UPSERT,
        attemptCount: 0,
        payload: { id: tenantId, name: "Nelna", slug: "nelna", isActive: true }
      })
    ).rejects.toThrow("Strict database replication failed");

    expect(service.replicationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "outbox-1" },
        data: expect.objectContaining({
          status: "FAILED",
          attemptCount: { increment: 1 },
          lastError: expect.stringContaining("Backup database is not configured")
        })
      })
    );
  });

  it("applies backup events with idempotent stable-id upserts", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: tenantId });
    const backup = {
      tenant: { upsert }
    } as any;

    await applyReplicationEventToBackup(backup, {
      modelName: "Tenant",
      entityId: tenantId,
      operation: ReplicationOperation.UPSERT,
      payload: {
        id: tenantId,
        name: "Nelna",
        slug: "nelna",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        users: [{ id: "ignored-relation" }]
      }
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { id: tenantId },
      create: expect.objectContaining({ id: tenantId, slug: "nelna" }),
      update: expect.not.objectContaining({ id: tenantId })
    });
    expect(upsert.mock.calls[0][0].create.users).toBeUndefined();
    expect(upsert.mock.calls[0][0].create.createdAt).toBeInstanceOf(Date);
  });

  it("lets async primary writes survive backup outages and retries later", async () => {
    const event = {
      id: "outbox-1",
      modelName: "Tenant",
      entityId: tenantId,
      operation: ReplicationOperation.UPSERT,
      status: ReplicationOutboxStatus.PENDING,
      attemptCount: 0,
      payload: { id: tenantId, name: "Nelna", slug: "nelna", isActive: true }
    };
    const prisma = {
      getReplicationConfig: jest.fn().mockReturnValue({
        enabled: true,
        mode: "async_outbox",
        retryAttempts: 5,
        retryDelayMs: 1000,
        batchSize: 100
      }),
      getBackup: jest.fn().mockReturnValue(null),
      replicationOutbox: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({})
      }
    } as any;
    const worker = new ReplicationSyncService(prisma);

    await expect(worker.processPendingBatch()).resolves.toEqual({
      claimed: 1,
      synced: 0,
      failed: 1,
      deadLetter: 0
    });

    expect(prisma.replicationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "outbox-1" },
        data: expect.objectContaining({
          status: ReplicationOutboxStatus.FAILED,
          attemptCount: 1,
          lastError: expect.stringContaining("Backup database is not configured")
        })
      })
    );
  });

  it("moves exhausted retry events to the dead-letter state", async () => {
    const event = {
      id: "outbox-1",
      modelName: "Tenant",
      entityId: tenantId,
      operation: ReplicationOperation.UPSERT,
      status: ReplicationOutboxStatus.FAILED,
      attemptCount: 0,
      payload: { id: tenantId, name: "Nelna", slug: "nelna", isActive: true }
    };
    const prisma = {
      getReplicationConfig: jest.fn().mockReturnValue({
        enabled: true,
        mode: "async_outbox",
        retryAttempts: 1,
        retryDelayMs: 1000,
        batchSize: 100
      }),
      getBackup: jest.fn().mockReturnValue(null),
      replicationOutbox: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({})
      }
    } as any;
    const worker = new ReplicationSyncService(prisma);

    await expect(worker.processPendingBatch()).resolves.toEqual({
      claimed: 1,
      synced: 0,
      failed: 0,
      deadLetter: 1
    });

    expect(prisma.replicationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ReplicationOutboxStatus.DEAD_LETTER })
      })
    );
  });

  it("reports degraded async replication without making readiness require the backup", async () => {
    const prisma = {
      getReplicationConfig: jest.fn().mockReturnValue({
        enabled: true,
        mode: "async_outbox",
        backupDatabaseUrl: "mongodb://<redacted>",
        backupRequiredForReadiness: false,
        backupRequiredForStrictMode: true,
        primaryDatabaseName: "nelna",
        backupDatabaseName: "bileeta_db"
      })
    } as any;
    const replicationSync = {
      getStatusSnapshot: jest.fn().mockResolvedValue({
        enabled: true,
        configured: true,
        mode: "async_outbox",
        primaryDatabaseName: "nelna",
        backupDatabaseName: "bileeta_db",
        backupStatus: "degraded",
        strictModeActive: false,
        pendingEvents: 4,
        processingEvents: 0,
        failedEvents: 1,
        deadLetterEvents: 0,
        lastSuccessfulSync: "2026-01-01T00:00:00.000Z",
        replicationLagMs: 5000,
        message: "1 failed and 0 dead-letter replication event(s) need attention."
      })
    } as any;
    const configService = { get: jest.fn() } as any;
    const health = new HealthService(prisma, replicationSync, configService) as any;

    await expect(health.checkBackupReplication()).resolves.toMatchObject({
      key: "backupDatabaseReplication",
      status: "degraded",
      required: false,
      details: {
        mode: "async_outbox",
        pendingEvents: 4,
        failedEvents: 1,
        replicationLagMs: 5000
      }
    });
  });

  it("protects the replication admin status endpoint with auth and system settings permission", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ReplicationAdminController);
    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      ReplicationAdminController.prototype.status
    );

    expect(guards).toContain(JwtAuthGuard);
    expect(permissions).toEqual(["settings.system.manage"]);
  });
});