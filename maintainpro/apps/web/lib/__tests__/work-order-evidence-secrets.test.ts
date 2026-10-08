import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evidencePayloadHasSecrets,
  type EvidenceStorageReadiness,
  type WorkOrderEvidenceItem
} from "../work-order-evidence";

const configuredMinio: EvidenceStorageReadiness = {
  providerId: "minio",
  mode: "minio",
  state: "configured",
  uploadsEnabled: true,
  maxFileSizeMb: 10,
  allowedMimeTypes: ["image/jpeg", "image/png"],
  message: "MinIO evidence storage is ready.",
  missingKeys: []
};

function evidenceItem(overrides: Partial<WorkOrderEvidenceItem> = {}): WorkOrderEvidenceItem {
  return {
    id: "ev-1",
    fileName: "after-repair.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 2048,
    status: "UPLOADED",
    evidenceType: "AFTER_PHOTO",
    verificationStatus: "PENDING",
    rejectedReason: null,
    note: null,
    isRequired: true,
    capturedAt: null,
    source: "WEB",
    clientGeneratedId: null,
    offlineCreatedAt: null,
    syncedAt: null,
    syncStatus: null,
    syncError: null,
    uploadedByName: "Tech A",
    createdAt: "2026-10-08T00:00:00.000Z",
    downloadAvailable: true,
    ...overrides
  };
}

test("configured MinIO storage readiness is not reported as secret-like", () => {
  assert.equal(evidencePayloadHasSecrets({ items: [evidenceItem()], readiness: configuredMinio }), false);
});

test("missing env var names in readiness are not reported as secret-like", () => {
  const notConfigured: EvidenceStorageReadiness = {
    ...configuredMinio,
    state: "not_configured",
    uploadsEnabled: false,
    message: "Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY to enable uploads.",
    missingKeys: ["MINIO_ACCESS_KEY", "MINIO_SECRET_KEY"]
  };
  assert.equal(evidencePayloadHasSecrets({ items: [], readiness: notConfigured }), false);
});

test("free-text notes and file names that mention secret words are not reported", () => {
  const item = evidenceItem({
    fileName: "token-ring-gasket.jpg",
    note: "Replaced the access token reader; secret panel resealed."
  });
  assert.equal(evidencePayloadHasSecrets({ items: [item], readiness: configuredMinio }), false);
});

test("storage internals leaked as fields are reported", () => {
  for (const leaked of [
    { storageKey: "work-orders/ev-1.jpg" },
    { storage_key: "work-orders/ev-1.jpg" },
    { presignedUrl: "https://minio.local/bucket/ev-1.jpg?X-Amz-Signature=abc" },
    { accessKey: "AKIA" },
    { secretAccessKey: "s3cr3t" },
    { downloadToken: "t0k3n" }
  ]) {
    const item = { ...evidenceItem(), ...leaked };
    assert.equal(
      evidencePayloadHasSecrets({ items: [item], readiness: configuredMinio }),
      true,
      `expected ${Object.keys(leaked)[0]} to be reported`
    );
  }
});

test("secret-like fields nested in readiness are reported", () => {
  const leakedReadiness = { ...configuredMinio, credentials: { secretKey: "s3cr3t" } };
  assert.equal(evidencePayloadHasSecrets({ items: [], readiness: leakedReadiness }), true);
});

test("empty payloads are not reported", () => {
  assert.equal(evidencePayloadHasSecrets(null), false);
  assert.equal(evidencePayloadHasSecrets(undefined), false);
  assert.equal(evidencePayloadHasSecrets({ items: [], readiness: null }), false);
});
