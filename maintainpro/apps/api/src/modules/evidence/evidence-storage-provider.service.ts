import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { statSync, statfsSync, writeFileSync, unlinkSync, existsSync, realpathSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { isPrivateAbsoluteStorageRoot } from "../../config/local-storage-root";

import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  DEFAULT_EVIDENCE_MAX_FILE_SIZE_MB,
  EvidenceStorageMode,
  EvidenceStorageReadiness,
  EvidenceStorageReadinessState,
  EvidenceUploadRequestResult,
  mapEvidenceStorageIndicator,
  evidenceBytesMatchMime,
  parseAllowedMimeTypes
} from "./evidence-storage.mapper";

export type EvidenceProviderUploadRequestInput = {
  attachmentId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type EvidenceProviderUploadRequestOutput = {
  ok: boolean;
  uploadMethod: "mock" | "presigned" | "direct";
  uploadUrl: string | null;
  expiresAt: string | null;
  message: string;
};

@Injectable()
export class EvidenceStorageProviderService implements OnModuleInit {
  private readonly logger = new Logger(EvidenceStorageProviderService.name);

  onModuleInit(): void {
    if (!this.isProduction() || this.resolveMode() !== "local") return;
    const readiness = this.checkReadiness();
    if (readiness.state !== "configured" || readiness.lowDiskSpace) this.logger.warn(readiness.message);
  }
  constructor(private readonly configService: ConfigService) {}

  checkReadiness(): EvidenceStorageReadiness {
    const mode = this.resolveMode();
    const uploadsEnabled = this.isUploadsEnabled();
    const maxFileSizeMb = this.resolveMaxFileSizeMb();
    const allowedMimeTypes = parseAllowedMimeTypes(
      this.configService.get<string>("STORAGE_ALLOWED_MIME_TYPES")
    );
    const missingKeys = this.missingProviderKeys(mode);

    if (mode === "disabled") {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode,
        state: "disabled",
        uploadsEnabled,
        maxFileSizeMb,
        allowedMimeTypes,
        message: "Evidence storage uploads are disabled by STORAGE_MODE=disabled.",
        missingKeys: []
      });
    }

    if (mode === "local") {
      return this.localReadiness({ uploadsEnabled, maxFileSizeMb, allowedMimeTypes });
    }

    if (mode === "mock") {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode,
        state: "disabled",
        uploadsEnabled: false,
        maxFileSizeMb,
        allowedMimeTypes,
        message: "Mock evidence storage does not store file bytes. Use STORAGE_MODE=local with STORAGE_LOCAL_ROOT for isolated development.",
        missingKeys: ["STORAGE_MODE"]
      });
    }

    if (!uploadsEnabled) {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode,
        state: "disabled",
        uploadsEnabled: false,
        maxFileSizeMb,
        allowedMimeTypes,
        message: "Evidence uploads are disabled. Set STORAGE_UPLOADS_ENABLED=true after provider sign-off.",
        missingKeys: ["STORAGE_UPLOADS_ENABLED"]
      });
    }

    if (missingKeys.length >= 2) {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode,
        state: "not_configured",
        uploadsEnabled,
        maxFileSizeMb,
        allowedMimeTypes,
        message: "Evidence storage provider settings are missing.",
        missingKeys
      });
    }

    if (missingKeys.length > 0) {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode,
        state: "misconfigured",
        uploadsEnabled,
        maxFileSizeMb,
        allowedMimeTypes,
        message: "Evidence storage provider settings are incomplete.",
        missingKeys
      });
    }

    return this.finalizeReadiness({
      providerId: "EVIDENCE_OBJECT_STORAGE",
      mode,
      state: "misconfigured",
      uploadsEnabled,
      maxFileSizeMb,
      allowedMimeTypes,
      message: `${mode} credentials are present, but live byte transfer is not implemented. Uploads stay disabled.`,
      missingKeys: []
    });
  }

  private localReadiness(input: {
    uploadsEnabled: boolean;
    maxFileSizeMb: number;
    allowedMimeTypes: string[];
  }): EvidenceStorageReadiness {
    if (this.isProduction() && (!this.configService.get<boolean>("STORAGE_LOCAL_PRODUCTION", false) ||
        !isPrivateAbsoluteStorageRoot(this.configService.get<string>("STORAGE_LOCAL_ROOT", "")))) {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode: "local",
        state: "misconfigured",
        uploadsEnabled: input.uploadsEnabled,
        maxFileSizeMb: input.maxFileSizeMb,
        allowedMimeTypes: input.allowedMimeTypes,
        message: "Production local storage requires explicit opt-in and a private absolute root.",
        missingKeys: ["STORAGE_MODE"]
      });
    }

    if (!input.uploadsEnabled) {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode: "local",
        state: "disabled",
        uploadsEnabled: false,
        maxFileSizeMb: input.maxFileSizeMb,
        allowedMimeTypes: input.allowedMimeTypes,
        message: "Evidence uploads are disabled. Set STORAGE_UPLOADS_ENABLED=true and STORAGE_LOCAL_ROOT for isolated development.",
        missingKeys: ["STORAGE_UPLOADS_ENABLED"]
      });
    }

    const root = this.configuredLocalRoot();
    if (!root) {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode: "local",
        state: "misconfigured",
        uploadsEnabled: true,
        maxFileSizeMb: input.maxFileSizeMb,
        allowedMimeTypes: input.allowedMimeTypes,
        message: "Local evidence storage needs STORAGE_LOCAL_ROOT, a private directory outside the repository.",
        missingKeys: ["STORAGE_LOCAL_ROOT"]
      });
    }

    let writable = false;
    let freeSpaceBytes: number | null = null;
    if (this.isProduction()) {
      const probe = path.join(root, `.readiness-${randomUUID()}`);
      try {
        if (!statSync(root).isDirectory()) throw new Error("not a directory");
        writeFileSync(probe, "probe", { flag: "wx" });
        unlinkSync(probe);
        writable = true;
        const disk = statfsSync(root);
        freeSpaceBytes = disk.bavail * disk.bsize;
      } catch {
        return this.finalizeReadiness({ providerId: "EVIDENCE_OBJECT_STORAGE", mode: "local",
          state: "misconfigured", ...input, rootSet: true, writable: false, freeSpaceBytes,
          message: "Local evidence directory must exist, permit write/delete, and report disk capacity.", missingKeys: [] });
      }
    }
    const lowDiskSpace = freeSpaceBytes !== null && freeSpaceBytes < 5 * 1024 ** 3;
    return this.finalizeReadiness({
      rootSet: true, writable: this.isProduction() ? writable : undefined, freeSpaceBytes, lowDiskSpace,
      providerId: "EVIDENCE_OBJECT_STORAGE",
      mode: "local",
      state: "configured",
      uploadsEnabled: true,
      maxFileSizeMb: input.maxFileSizeMb,
      allowedMimeTypes: input.allowedMimeTypes,
      message: lowDiskSpace ? "Warning: local evidence disk has less than 5 GB available." : "Local private file storage is ready.",
      missingKeys: []
    });
  }

  private finalizeReadiness(
    readiness: Omit<EvidenceStorageReadiness, "indicator">
  ): EvidenceStorageReadiness {
    return {
      ...readiness,
      indicator: mapEvidenceStorageIndicator(readiness)
    };
  }

  createUploadRequest(
    input: EvidenceProviderUploadRequestInput
  ): EvidenceProviderUploadRequestOutput {
    const readiness = this.checkReadiness();

    if (readiness.state === "disabled" || readiness.state === "not_configured") {
      return {
        ok: false,
        uploadMethod: "mock",
        uploadUrl: null,
        expiresAt: null,
        message: readiness.message
      };
    }

    if (readiness.state === "misconfigured") {
      return {
        ok: false,
        uploadMethod: "mock",
        uploadUrl: null,
        expiresAt: null,
        message: readiness.message
      };
    }

    if (readiness.mode === "local") {
      return {
        ok: true,
        uploadMethod: "direct",
        uploadUrl: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        message: "Send the file bytes to the evidence content endpoint, then confirm after storage verification."
      };
    }

    return {
      ok: false,
      uploadMethod: "presigned",
      uploadUrl: null,
      expiresAt: null,
      message:
        "Provider credentials are present, but live presigned upload is not enabled in this foundation release. Use mock mode for UAT."
    };
  }

  async putObject(storageKey: string, bytes: Buffer): Promise<void> {
    const absolute = this.resolveObjectPath(storageKey);
    const readiness = this.checkReadiness();
    if (readiness.mode !== "local" || readiness.state !== "configured") throw new BadRequestException("Local evidence storage is not ready.");
    const mime = ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" } as Record<string, string>)[path.extname(storageKey).toLowerCase()];
    if (!mime || !readiness.allowedMimeTypes.includes(mime) || !evidenceBytesMatchMime(bytes, mime)) throw new BadRequestException("Evidence file contents or MIME type are not allowed.");
    if (!bytes.length || bytes.length > readiness.maxFileSizeMb * 1024 * 1024) throw new BadRequestException("Evidence exceeds the configured size limit.");
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    await writeFile(this.resolveObjectPath(storageKey + ".sha256"), createHash("sha256").update(bytes).digest("hex"));
  }

  async readObject(storageKey: string): Promise<Buffer> {
    const bytes = await readFile(this.resolveObjectPath(storageKey));
    let expected: string;
    try {
      expected = (await readFile(this.resolveObjectPath(storageKey + ".sha256"), "utf8")).trim();
    } catch (error) {
      // Historical evidence/ keys predate checksums. New layout always requires one.
      if (storageKey.replace(/\\/g, "/").startsWith("evidence/") && (error as NodeJS.ErrnoException).code === "ENOENT") return bytes;
      throw new BadRequestException("Stored evidence checksum is unavailable.");
    }
    if (expected !== createHash("sha256").update(bytes).digest("hex")) throw new BadRequestException("Stored evidence checksum mismatch.");
    return bytes;
  }

  async deleteObject(storageKey: string): Promise<void> {
    await rm(this.resolveObjectPath(storageKey), { force: true });
    await rm(this.resolveObjectPath(storageKey + ".sha256"), { force: true });
  }

  getDownloadUrl(): { ok: false; url: null; message: string } {
    const readiness = this.checkReadiness();
    if (readiness.mode !== "mock" || readiness.state !== "configured") {
      return {
        ok: false,
        url: null,
        message: "Download URLs require an approved live storage provider UAT."
      };
    }

    return {
      ok: false,
      url: null,
      message: "Mock evidence storage does not serve downloadable file bytes."
    };
  }

  toBlockedUploadRequest(readiness: EvidenceStorageReadiness): EvidenceUploadRequestResult {
    return {
      ok: false,
      status:
        readiness.state === "not_configured"
          ? "not_configured"
          : readiness.state === "misconfigured"
            ? "misconfigured"
            : "blocked",
      mode: readiness.mode,
      message: readiness.message
    };
  }

  private configuredLocalRoot(): string | null {
    const value = this.configService.get<string>("STORAGE_LOCAL_ROOT", "").trim();
    return value ? path.resolve(value) : null;
  }

  private resolveObjectPath(storageKey: string): string {
    const root = this.configuredLocalRoot();
    if (!root) {
      throw new BadRequestException("Local evidence storage is not configured.");
    }
    const normalized = storageKey.replace(/\\/g, "/");
    if (path.isAbsolute(normalized) || path.win32.isAbsolute(normalized) || normalized.includes(":") || normalized.split("/").some((segment) => segment === ".." || segment === "." || segment === "" || /[. ]$/.test(segment) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(segment))) {
      throw new BadRequestException("Evidence path is not allowed.");
    }
    const absolute = path.resolve(root, ...normalized.split("/"));
    const relative = path.relative(root, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new BadRequestException("Evidence path is not allowed.");
    }
    // Reject junction/symlink escapes, including existing parent directories.
    if (existsSync(root)) {
      let ancestor = absolute;
      while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
      const realRelative = path.relative(realpathSync(root), realpathSync(ancestor));
      if (realRelative === ".." || realRelative.startsWith(".." + path.sep) || path.isAbsolute(realRelative)) {
        throw new BadRequestException("Evidence path is not allowed.");
      }
    }
    return absolute;
  }

  private resolveMode(): EvidenceStorageMode {
    const explicit = this.configService.get<string>("STORAGE_MODE", "local").trim().toLowerCase();
    const allowed: EvidenceStorageMode[] = [
      "disabled",
      "mock",
      "local",
      "azure_blob",
      "s3",
      "r2",
      "minio",
      "cloudinary"
    ];

    if (allowed.includes(explicit as EvidenceStorageMode)) {
      return explicit as EvidenceStorageMode;
    }

    return "local";
  }

  private missingProviderKeys(mode: EvidenceStorageMode): string[] {
    if (mode === "mock" || mode === "disabled" || mode === "local") {
      return [];
    }

    if (mode === "cloudinary") {
      return ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter(
        (key) => !this.hasConfigValue(key)
      );
    }

    if (mode === "minio") {
      return ["MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET"].filter(
        (key) => !this.hasConfigValue(key)
      );
    }

    if (mode === "s3" || mode === "r2" || mode === "azure_blob") {
      return [`${mode.toUpperCase()} credentials not configured in WO-012 foundation`];
    }

    return ["STORAGE_MODE"];
  }

  private isUploadsEnabled(): boolean {
    return this.configService.get<boolean>("STORAGE_UPLOADS_ENABLED", false);
  }

  private resolveMaxFileSizeMb(): number {
    const configured = Number(this.configService.get<number>("STORAGE_MAX_FILE_SIZE_MB", DEFAULT_EVIDENCE_MAX_FILE_SIZE_MB));
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_EVIDENCE_MAX_FILE_SIZE_MB;
  }

  private isProduction(): boolean {
    return this.configService.get<string>("NODE_ENV", "development") === "production";
  }

  private isMockAllowed(): boolean {
    return this.configService.get<boolean>("ALLOW_MOCK_IN_PRODUCTION", false);
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }
}
