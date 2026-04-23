import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import mongoose from "mongoose";

import { PrismaService } from "./prisma.service";

type PrismaDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
};

@Injectable()
export class MongoSyncService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MongoSyncService.name);
  private readonly prismaModelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const shouldSync = this.toBoolean(process.env.MONGO_SYNC_ON_STARTUP ?? "false");

    if (!shouldSync) {
      return;
    }

    const mongodbUri = process.env.MONGODB_URI;
    if (!mongodbUri) {
      this.logger.warn(
        "MONGO_SYNC_ON_STARTUP is enabled but MONGODB_URI is empty. Skipping Mongo sync."
      );
      return;
    }

    try {
      await this.syncAllModels(mongodbUri);
    } catch (error) {
      this.logger.error(`Mongo sync failed: ${(error as Error).message}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  private async syncAllModels(mongodbUri: string): Promise<void> {
    const startedAt = Date.now();

    await mongoose.connect(mongodbUri, {
      serverApi: {
        version: "1",
        strict: true,
        deprecationErrors: true
      }
    });

    const mongoDb = mongoose.connection.db;
    if (!mongoDb) {
      throw new Error("MongoDB connection is not ready.");
    }

    let collectionsSynced = 0;
    let documentsSynced = 0;

    for (const modelName of this.prismaModelNames) {
      const delegate = this.getDelegateForModel(modelName);
      if (!delegate) {
        continue;
      }

      const rows = await delegate.findMany();
      const normalizedRows = rows.map((row) => this.normalizeValue(row)) as Record<string, unknown>[];
      const collection = mongoDb.collection(this.toCollectionName(modelName));

      await collection.deleteMany({});

      if (normalizedRows.length > 0) {
        await collection.insertMany(normalizedRows, { ordered: false });
      }

      collectionsSynced += 1;
      documentsSynced += normalizedRows.length;
    }

    this.logger.log(
      `Mongo sync completed: ${collectionsSynced} collections, ${documentsSynced} documents in ${Date.now() - startedAt}ms.`
    );
  }

  private getDelegateForModel(modelName: string): PrismaDelegate | null {
    const delegateName = `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`;
    const delegateCandidate = (this.prisma as unknown as Record<string, unknown>)[delegateName];

    if (
      delegateCandidate &&
      typeof (delegateCandidate as PrismaDelegate).findMany === "function"
    ) {
      return delegateCandidate as PrismaDelegate;
    }

    return null;
  }

  private toCollectionName(modelName: string): string {
    return modelName;
  }

  private toBoolean(value: string): boolean {
    return value.trim().toLowerCase() === "true";
  }

  private normalizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value instanceof Prisma.Decimal) {
      return value.toString();
    }

    if (value instanceof Date || Buffer.isBuffer(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.normalizeValue(entry));
    }

    if (typeof value === "object") {
      const normalizedObject: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        normalizedObject[key] = this.normalizeValue(nestedValue);
      }
      return normalizedObject;
    }

    return value;
  }
}