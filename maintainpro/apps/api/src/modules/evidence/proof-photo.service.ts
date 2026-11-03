import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { EvidenceStorageProviderService } from "./evidence-storage-provider.service";

/** Where proof photos belong. Each folder is one kind of record that needs a photo. */
export const PROOF_PHOTO_FOLDERS = ["fuel", "meter", "goods-in"] as const;
export type ProofPhotoFolder = (typeof PROOF_PHOTO_FOLDERS)[number];

export type ProofPhotoUpload = { buffer?: Buffer; mimetype?: string; size?: number } | undefined;

export const PROOF_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf"
};
const CONTENT_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };

const KEY_PATTERN = /^proof\/([A-Za-z0-9_-]{1,64})\/(fuel|meter|goods-in)\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

function isProduction() {
  return String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

/** True when the stored key is a proof photo of this tenant (never a path outside proof/). */
export function proofPhotoKeyBelongsTo(key: string, tenantId: string): boolean {
  const match = KEY_PATTERN.exec(key);
  return Boolean(match && match[1] === tenantId);
}

/**
 * Photo proof for records people could otherwise make up (fuel receipt, meter photo, GRN).
 * A photo is required whenever photo storage works. In production a record cannot be saved
 * while storage is down (same fail-closed rule as job before/after photos); outside production
 * the record is allowed without a photo so local work is not blocked.
 */
@Injectable()
export class ProofPhotoService {
  constructor(@Inject(EvidenceStorageProviderService) private readonly storage: EvidenceStorageProviderService) {}

  storageReady(): boolean {
    const readiness = this.storage.checkReadiness();
    return readiness.mode === "local" && readiness.state === "configured" && readiness.uploadsEnabled;
  }

  /** Returns the stored key, or null when storage is off outside production. */
  async requireAndSave(tenantId: string, folder: ProofPhotoFolder, file: ProofPhotoUpload, what: string): Promise<string | null> {
    if (!this.storageReady()) {
      if (isProduction()) {
        throw new BadRequestException(`The ${what} photo cannot be stored right now, so this cannot be saved. Ask an admin to check photo storage.`);
      }
      return null;
    }
    if (!file?.buffer?.length) throw new BadRequestException(`Add a photo of the ${what}.`);
    if (file.buffer.length > PROOF_PHOTO_MAX_BYTES) throw new BadRequestException("The photo is larger than 10 MB.");
    const extension = EXTENSIONS[String(file.mimetype ?? "").toLowerCase()];
    if (!extension) throw new BadRequestException("The photo must be a JPG, PNG or WEBP picture (or a PDF).");
    const month = new Date().toISOString().slice(0, 7);
    const key = `proof/${tenantId}/${folder}/${month}/${randomUUID()}${extension}`;
    await this.storage.putObject(key, file.buffer);
    return key;
  }

  async read(tenantId: string, key: string): Promise<{ bytes: Buffer; contentType: string }> {
    if (!proofPhotoKeyBelongsTo(key, tenantId)) throw new ForbiddenException("This photo is not available.");
    const extension = key.slice(key.lastIndexOf("."));
    const bytes = await this.storage.readObject(key);
    return { bytes, contentType: CONTENT_TYPES[extension === ".jpeg" ? ".jpg" : extension] ?? "application/octet-stream" };
  }
}
