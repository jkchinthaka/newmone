import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  DEFAULT_EVIDENCE_MAX_FILE_SIZE_MB,
  EvidenceStorageMode,
  EvidenceStorageReadiness,
  EvidenceStorageReadinessState,
  EvidenceUploadRequestResult,
  mapEvidenceStorageIndicator,
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
  uploadMethod: "mock" | "presigned";
  uploadUrl: string | null;
  expiresAt: string | null;
  message: string;
};

@Injectable()
export class EvidenceStorageProviderService {
  constructor(private readonly configService: ConfigService) {}

  checkReadiness(): EvidenceStorageReadiness {
    const mode = this.resolveMode();
    const uploadsEnabled = this.isUploadsEnabled();
    const maxFileSizeMb = this.resolveMaxFileSizeMb();
    const allowedMimeTypes = parseAllowedMimeTypes(
      this.configService.get<string>("STORAGE_ALLOWED_MIME_TYPES")
    );
    const missingKeys = this.missingProviderKeys(mode);

    if (mode === "disabled" || mode === "local") {
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode,
        state: "disabled",
        uploadsEnabled,
        maxFileSizeMb,
        allowedMimeTypes,
        message:
          mode === "local"
            ? "Evidence uploads require a dedicated storage mode (mock, minio, s3, cloudinary, azure_blob)."
            : "Evidence storage uploads are disabled by STORAGE_MODE=disabled.",
        missingKeys: mode === "local" ? ["STORAGE_MODE"] : []
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

    if (mode === "mock") {
      const blockedInProduction = this.isProduction() && !this.isMockAllowed();
      return this.finalizeReadiness({
        providerId: "EVIDENCE_OBJECT_STORAGE",
        mode,
        state: blockedInProduction ? "misconfigured" : "configured",
        uploadsEnabled,
        maxFileSizeMb,
        allowedMimeTypes,
        message: blockedInProduction
          ? "Mock evidence uploads are blocked in production unless explicitly allowed."
          : "Mock evidence storage is enabled for metadata-only upload UAT.",
        missingKeys: []
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
      state: "configured",
      uploadsEnabled,
      maxFileSizeMb,
      allowedMimeTypes,
      message: `${mode} evidence storage is configured; presigned upload UAT still required before live bytes transfer.`,
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

    if (readiness.mode === "mock") {
      return {
        ok: true,
        uploadMethod: "mock",
        uploadUrl: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        message:
          "Mock upload request accepted. Confirm upload after client-side validation; no external storage call is made."
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
