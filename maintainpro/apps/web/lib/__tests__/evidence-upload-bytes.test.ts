import assert from "node:assert/strict";
import test from "node:test";

import { isEvidenceUploadEnabled, offlineEvidenceRetryBlock } from "../work-order-evidence";

const base = {
  providerId: "EVIDENCE_OBJECT_STORAGE",
  uploadsEnabled: true,
  maxFileSizeMb: 10,
  allowedMimeTypes: ["image/jpeg"],
  message: "",
  missingKeys: []
};

test("mock metadata mode does not enable file upload", () => {
  assert.equal(
    isEvidenceUploadEnabled({ ...base, mode: "mock", state: "configured" }),
    false
  );
});

test("local configured storage enables file upload", () => {
  assert.equal(
    isEvidenceUploadEnabled({ ...base, mode: "local", state: "configured" }),
    true
  );
});

test("offline retry does not report success without the original file", () => {
  const result = offlineEvidenceRetryBlock();
  assert.equal(result.ok, false);
  assert.match(result.message, /Choose the file again/);
});
