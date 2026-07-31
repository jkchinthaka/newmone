/**
 * Pure release-workflow helpers for Phase 3 (no secrets, no .env value reads).
 */

import { createHash } from "node:crypto";

export const APPROVED_RELEASE_BRANCHES = [
  "main",
  "fix/phase3-release-source-alignment",
  "fix/phase1-phase2-production-remediation"
];

export const PERSISTENT_SERVICES = ["mongo", "redis", "minio", "minio-init"];
export const ALLOWED_DEPLOY_SERVICES = ["api", "web", "nginx"];
export const FORBIDDEN_DEPLOY_SERVICES = [...PERSISTENT_SERVICES, "db", "database", "volume"];

export function assertCleanWorkingTree(statusShort) {
  const dirty = String(statusShort || "").trim();
  if (dirty.length > 0) {
    return {
      ok: false,
      code: "DEPLOY-REL-001",
      message: "Dirty working tree blocks release preparation."
    };
  }
  return { ok: true, code: "DEPLOY-REL-001", message: "Working tree is clean." };
}

export function assertApprovedReleaseRef(branchOrRef, options = {}) {
  const value = String(branchOrRef || "").trim();
  const approved = options.approvedBranches || APPROVED_RELEASE_BRANCHES;
  const allowExactSha = options.allowExactSha !== false;
  if (!value) {
    return {
      ok: false,
      code: "DEPLOY-REL-015",
      message: "Release from an empty branch/ref is rejected."
    };
  }
  if (approved.includes(value)) {
    return { ok: true, code: "DEPLOY-REL-015", message: "Approved release branch/ref." };
  }
  if (allowExactSha && /^[0-9a-f]{40}$/i.test(value)) {
    return { ok: true, code: "DEPLOY-REL-015", message: "Approved exact release SHA." };
  }
  if (/^maintainpro-v\d+\.\d+\.\d+$/.test(value)) {
    return { ok: true, code: "DEPLOY-REL-015", message: "Approved release tag format." };
  }
  return {
    ok: false,
    code: "DEPLOY-REL-015",
    message: `Release from an unapproved branch is rejected: ${value}`
  };
}

export function buildImmutableImageTags(gitSha, releaseVersion) {
  const sha = String(gitSha || "").trim().toLowerCase();
  if (!sha || sha === "latest" || sha === "unknown") {
    throw new Error("DEPLOY-REL-005: Images require an immutable Git SHA tag.");
  }
  /** @type {Record<string, string>} */
  const tags = {
    api: `maintainpro-api:${sha}`,
    web: `maintainpro-web:${sha}`,
    sha
  };
  if (releaseVersion) {
    tags.apiVersion = `maintainpro-api:${releaseVersion}`;
    tags.webVersion = `maintainpro-web:${releaseVersion}`;
  }
  return tags;
}

export function assertNotLatestOnly(tags) {
  const values = Object.values(tags || {}).filter((t) => typeof t === "string");
  const hasSha = values.some((t) => /:[0-9a-f]{7,40}$/i.test(String(t)));
  const onlyLatest = values.length > 0 && values.every((t) => String(t).endsWith(":latest"));
  if (onlyLatest || !hasSha) {
    return {
      ok: false,
      code: "DEPLOY-REL-005",
      message: "Images must use immutable SHA tags; latest-only is forbidden."
    };
  }
  return { ok: true, code: "DEPLOY-REL-005", message: "Immutable SHA image tags present." };
}

export function selectRollbackImages(previous) {
  const apiImage = previous?.apiImage;
  const webImage = previous?.webImage;
  if (!apiImage || !webImage) {
    return {
      ok: false,
      code: "DEPLOY-REL-010",
      message: "Rollback requires previous API and Web image tags."
    };
  }
  if (String(apiImage).endsWith(":latest") || String(webImage).endsWith(":latest")) {
    return {
      ok: false,
      code: "DEPLOY-REL-010",
      message: "Rollback must not select latest tags."
    };
  }
  return {
    ok: true,
    code: "DEPLOY-REL-010",
    message: "Rollback selected previous API/Web image tags.",
    apiImage,
    webImage
  };
}

export function assertPersistentServicesPreserved(servicesToRecreate) {
  const selected = (servicesToRecreate || []).map((s) => String(s).toLowerCase());
  const hits = selected.filter(
    (s) => FORBIDDEN_DEPLOY_SERVICES.includes(s) || PERSISTENT_SERVICES.includes(s)
  );
  if (hits.length) {
    return {
      ok: false,
      code: "DEPLOY-REL-017",
      message: `Deployment helper refuses destructive service selections: ${hits.join(", ")}`
    };
  }
  const unknown = selected.filter((s) => !ALLOWED_DEPLOY_SERVICES.includes(s));
  if (unknown.length) {
    return {
      ok: false,
      code: "DEPLOY-REL-017",
      message: `Deployment helper refuses unknown services: ${unknown.join(", ")}`
    };
  }
  return {
    ok: true,
    code: "DEPLOY-REL-008",
    message: "Persistent services preserved; only api/web/nginx allowed."
  };
}

export function assertRollbackPreservesVolumes(commandText) {
  const text = String(commandText || "").toLowerCase();
  if (text.includes("down -v") || text.includes("volume rm") || text.includes("system prune")) {
    return {
      ok: false,
      code: "DEPLOY-REL-011",
      message: "Rollback commands must preserve volumes."
    };
  }
  return { ok: true, code: "DEPLOY-REL-011", message: "Rollback commands preserve volumes." };
}

export function assertProductionEnvExists(exists) {
  if (!exists) {
    return {
      ok: false,
      code: "DEPLOY-REL-006",
      message: "Missing production .env blocks execution."
    };
  }
  return {
    ok: true,
    code: "DEPLOY-REL-006",
    message: "Production .env file exists (contents not read)."
  };
}

export function detectRuntimeGitShaMismatch(gitSha, runtimeSha) {
  const a = String(gitSha || "").trim().toLowerCase();
  const b = String(runtimeSha || "").trim().toLowerCase();
  if (!a || !b) {
    return {
      ok: false,
      code: "DEPLOY-REL-013",
      message: "Runtime/Git SHA mismatch detection requires both values."
    };
  }
  if (a !== b && !(a.startsWith(b) || b.startsWith(a))) {
    return {
      ok: false,
      code: "DEPLOY-REL-013",
      message: "Runtime/Git SHA mismatch is detected."
    };
  }
  return { ok: true, code: "DEPLOY-REL-013", message: "Runtime and Git SHAs match." };
}

export function detectDirectServerSourceChanges(statusShort) {
  const dirty = String(statusShort || "").trim();
  if (dirty.length > 0) {
    return {
      ok: false,
      code: "DEPLOY-REL-014",
      message: "Direct server source changes are detected."
    };
  }
  return {
    ok: true,
    code: "DEPLOY-REL-014",
    message: "Working tree matches committed source."
  };
}

export function sanitizeDeploymentEvidence(evidence) {
  const json = JSON.stringify(evidence ?? {});
  const forbidden = [
    /mongodb(\+srv)?:\/\/[^\s"']+/gi,
    /password\s*[:=]\s*[^\s,"']+/gi,
    /secret\s*[:=]\s*[^\s,"']+/gi,
    /Bearer\s+[A-Za-z0-9._\-]+/gi,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/gi
  ];
  for (const re of forbidden) {
    if (re.test(json)) {
      return {
        ok: false,
        code: "DEPLOY-REL-012",
        message: "Deployment evidence contains forbidden secret-like patterns."
      };
    }
  }
  const clone = JSON.parse(json);
  if (clone && typeof clone === "object") {
    delete clone.env;
    delete clone.environmentValues;
    delete clone.databaseUrl;
    delete clone.connectionString;
  }
  return {
    ok: true,
    code: "DEPLOY-REL-012",
    message: "Deployment evidence contains no secrets.",
    evidence: clone
  };
}

export function deploymentHelperDefaults() {
  return {
    dryRun: true,
    requireExplicitExecute: true,
    code: "DEPLOY-REL-016",
    message: "Deployment helper defaults to dry-run."
  };
}

export function failOnFailedHealth(healthOk) {
  if (!healthOk) {
    return {
      ok: false,
      code: "DEPLOY-REL-009",
      message: "Failed health check fails deployment."
    };
  }
  return { ok: true, code: "DEPLOY-REL-009", message: "Health check passed." };
}

export function sha256Hex(bufferOrString) {
  return createHash("sha256").update(bufferOrString).digest("hex");
}

export function deterministicChecksum(content) {
  return sha256Hex(String(content).replace(/\r\n/g, "\n"));
}
