#!/usr/bin/env node
/**
 * prepare-release-build.mjs
 *
 * Builds a validated release package identity (SHA + timestamp + manifest).
 * Never reads or prints production `.env` values.
 * Never starts containers.
 *
 * Usage:
 *   node scripts/prepare-release-build.mjs
 *   node scripts/prepare-release-build.mjs --dry-run
 *   node scripts/prepare-release-build.mjs --skip-docker
 *   node scripts/prepare-release-build.mjs --allow-dirty   (FORBIDDEN in real releases; tests only)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  assertApprovedReleaseRef,
  assertCleanWorkingTree,
  assertNotLatestOnly,
  buildImmutableImageTags
} from "./lib/release-workflow.mjs";
import { buildReleaseManifest, checksumFileContents } from "./lib/release-manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(maintainproRoot, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("--validate-only");
const skipDocker = args.has("--skip-docker") || dryRun;
const allowDirty = args.has("--allow-dirty");

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || maintainproRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, ...(options.env || {}) }
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim().slice(0, 2000);
    throw new Error(
      `Command failed (${command} ${commandArgs.join(" ")}): exit=${result.status}${detail ? `\n${detail}` : ""}`
    );
  }
  return (result.stdout || "").trim();
}

function git(argsList) {
  return run("git", argsList, { cwd: repoRoot });
}

function npmRun(script) {
  console.log(`→ npm run ${script}`);
  run("npm", ["run", script]);
}

function main() {
  console.log("prepare-release-build: starting");
  console.log(`mode: ${dryRun ? "dry-run/validate-only" : "full"}`);

  const statusShort = git(["status", "--short"]);
  const clean = assertCleanWorkingTree(statusShort);
  if (!clean.ok && !allowDirty) {
    console.error(`FAIL ${clean.code}: ${clean.message}`);
    process.exit(1);
  }
  if (!clean.ok && allowDirty) {
    console.warn(`WARN ${clean.code}: dirty tree allowed only for local experimentation`);
  }

  const branch = git(["branch", "--show-current"]);
  const approved = assertApprovedReleaseRef(branch);
  if (!approved.ok) {
    // Also allow detached HEAD at exact SHA when RELEASE_REF is provided.
    const releaseRef = (process.env.RELEASE_REF || "").trim();
    const refCheck = assertApprovedReleaseRef(releaseRef || branch);
    if (!refCheck.ok) {
      console.error(`FAIL ${approved.code}: ${approved.message}`);
      process.exit(1);
    }
  }

  const gitCommitSha = git(["rev-parse", "HEAD"]).toLowerCase();
  const buildTimestampUtc = new Date().toISOString();
  const releaseVersion =
    (process.env.APP_VERSION || "").trim() ||
    JSON.parse(readFileSync(path.join(maintainproRoot, "package.json"), "utf8")).version;

  console.log(`gitCommitSha=${gitCommitSha}`);
  console.log(`buildTimestampUtc=${buildTimestampUtc}`);
  console.log(`releaseVersion=${releaseVersion}`);
  console.log(`gitBranch=${branch}`);

  const imageTags = buildImmutableImageTags(gitCommitSha, releaseVersion);
  const tagCheck = assertNotLatestOnly(imageTags);
  if (!tagCheck.ok) {
    console.error(`FAIL ${tagCheck.code}: ${tagCheck.message}`);
    process.exit(1);
  }

  // Structural validations (never read production .env values)
  npmRun("validate:secret-safety");
  npmRun("validate:nginx-routing");
  npmRun("audit:tenant");
  npmRun("audit:rbac");
  npmRun("db:generate");

  if (!dryRun) {
    npmRun("lint");
    npmRun("typecheck");
    npmRun("test");
    // Phase 3 release self-tests
    console.log("→ node scripts/test/release-phase3.selftest.mjs");
    run("node", ["scripts/test/release-phase3.selftest.mjs"]);
    npmRun("build");
  } else {
    console.log("→ node scripts/test/release-phase3.selftest.mjs");
    run("node", ["scripts/test/release-phase3.selftest.mjs"]);
    console.log("dry-run: skipped lint/typecheck/test/build suite (run without --dry-run for full gate)");
  }

  console.log("→ compose config (CI fixture)");
  try {
    run("docker", [
      "compose",
      "--env-file",
      ".env.compose-ci",
      "-f",
      "docker-compose.yml",
      "config",
      "--quiet"
    ]);
  } catch (error) {
    if (dryRun) {
      console.warn(`WARN compose CI config: ${error.message}`);
    } else {
      throw error;
    }
  }

  console.log("→ compose config (production structure fixture)");
  const fixtureSrc = path.join(maintainproRoot, ".env.production.structure-fixture.example");
  const fixtureTmp = path.join(maintainproRoot, ".env.structure-validate.tmp");
  try {
    writeFileSync(fixtureTmp, readFileSync(fixtureSrc));
    run(
      "docker",
      [
        "compose",
        "--env-file",
        fixtureTmp,
        "-f",
        "docker-compose.yml",
        "-f",
        "docker-compose.production.yml",
        "config",
        "--quiet"
      ],
      {
        env: {
          MAINTAINPRO_COMPOSE_ENV_FILE: ".env.structure-validate.tmp"
        }
      }
    );
  } finally {
    try {
      if (existsSync(fixtureTmp)) {
        // keep cleanup best-effort; never print contents
        spawnSync(process.platform === "win32" ? "cmd" : "rm", process.platform === "win32" ? ["/c", "del", "/f", fixtureTmp] : ["-f", fixtureTmp], {
          shell: true
        });
      }
    } catch {
      // ignore
    }
  }

  let dockerBlocked = false;
  if (!skipDocker) {
    const dockerInfo = spawnSync("docker", ["info"], {
      encoding: "utf8",
      shell: process.platform === "win32"
    });
    if (dockerInfo.status !== 0) {
      dockerBlocked = true;
      console.warn("BLOCKED: Docker engine unavailable — skipping image build and image secret-path scan.");
    } else {
      console.log(`→ docker build api ${imageTags.api}`);
      run("docker", [
        "build",
        "-f",
        "apps/api/Dockerfile",
        "--target",
        "production",
        "-t",
        imageTags.api,
        ...(imageTags.apiVersion ? ["-t", imageTags.apiVersion] : []),
        "."
      ]);
      console.log(`→ docker build web ${imageTags.web}`);
      run("docker", [
        "build",
        "-f",
        "apps/web/Dockerfile",
        "--target",
        "production",
        "-t",
        imageTags.web,
        ...(imageTags.webVersion ? ["-t", imageTags.webVersion] : []),
        "."
      ]);
      console.log("→ validate:image-secrets");
      run("node", ["scripts/validate-image-secret-paths.mjs", imageTags.api, imageTags.web]);
    }
  } else {
    dockerBlocked = true;
    console.warn("SKIP/BLOCKED: Docker image build skipped (--skip-docker or --dry-run).");
  }

  const prismaSchema = readFileSync(path.join(maintainproRoot, "prisma", "schema.prisma"), "utf8");
  const packageLock = readFileSync(path.join(maintainproRoot, "package-lock.json"), "utf8");
  const nginxConfig = readFileSync(
    path.join(maintainproRoot, "infra", "nginx", "default.conf"),
    "utf8"
  );

  const knownBlockers = [];
  if (dockerBlocked) {
    knownBlockers.push("DOCKER_IMAGE_BUILD_OR_SCAN_BLOCKED");
  }
  knownBlockers.push("MONGO_ROOT_ROTATION_OPERATOR_REQUIRED");
  knownBlockers.push("LIVE_HTTP_SMOKE_OPERATOR_REQUIRED");
  knownBlockers.push("PRODUCTION_DEPLOYMENT_NOT_EXECUTED");

  const npmVersion = (() => {
    try {
      return run("npm", ["--version"]);
    } catch {
      return "";
    }
  })();

  const manifest = buildReleaseManifest({
    application: "maintainpro",
    releaseVersion,
    gitCommitSha,
    gitBranch: branch,
    buildTimestampUtc,
    nodeVersion: process.version,
    npmVersion,
    apiImage: imageTags.api,
    webImage: imageTags.web,
    composeFiles: ["docker-compose.yml", "docker-compose.production.yml"],
    prismaSchemaChecksum: checksumFileContents(prismaSchema),
    packageLockChecksum: checksumFileContents(packageLock),
    nginxConfigChecksum: checksumFileContents(nginxConfig),
    testsExecuted: dryRun
      ? ["release-phase3.selftest"]
      : [
          "validate:secret-safety",
          "validate:nginx-routing",
          "audit:tenant",
          "audit:rbac",
          "lint",
          "typecheck",
          "test",
          "release-phase3.selftest",
          "build"
        ],
    testResults: {
      mode: dryRun ? "dry-run" : "full",
      dockerImageValidation: dockerBlocked ? "BLOCKED" : "EXECUTED"
    },
    knownBlockers,
    operatorApprovalsRequired: [
      "change-ticket",
      "mongo-root-rotation-gate",
      "backup-confirmation",
      "branch-protection-operator-config"
    ]
  });

  const artifactsDir = path.join(maintainproRoot, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  const manifestPath = path.join(artifactsDir, "release-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote artifacts/release-manifest.json (gitignored content; example committed separately)`);
  console.log("prepare-release-build: PASS");
  console.log(
    JSON.stringify(
      {
        gitCommitSha,
        buildTimestampUtc,
        apiImage: imageTags.api,
        webImage: imageTags.web,
        dockerImageValidation: dockerBlocked ? "BLOCKED" : "PASS",
        dryRun
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(`prepare-release-build: FAIL — ${error.message}`);
  process.exit(1);
}
