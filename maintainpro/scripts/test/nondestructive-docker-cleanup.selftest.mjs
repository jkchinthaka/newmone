#!/usr/bin/env node
/**
 * Self-tests for nondestructive Docker cleanup detection (DOCKER-SAFE-001..012).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  detectDestructiveDockerCleanup,
  flattenExecutableText
} from "../validate-nondestructive-docker-cleanup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
let failed = 0;

function check(id, ok, detail) {
  if (ok) console.log(`PASS ${id}: ${detail}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${detail}`);
  }
}

const wf = readFileSync(path.join(repoRoot, ".github/workflows/full-stack-e2e.yml"), "utf8");
const flatWf = flattenExecutableText(wf);
check(
  "DOCKER-SAFE-001",
  /\bdown\s+--remove-orphans\b/.test(flatWf) && !/\bdown\b[\s\S]{0,80}--volumes\b/.test(flatWf),
  "workflow uses down --remove-orphans"
);
check(
  "DOCKER-SAFE-002",
  detectDestructiveDockerCleanup(wf).length === 0,
  "workflow has no compose down volume flag"
);

check(
  "DOCKER-SAFE-003",
  detectDestructiveDockerCleanup("docker compose -p x down -v").some(
    (f) => f.category === "compose-down-with-volumes"
  ),
  "docker compose down -v rejected"
);
check(
  "DOCKER-SAFE-004",
  detectDestructiveDockerCleanup("docker compose down --volumes --remove-orphans").some(
    (f) => f.category === "compose-down-with-volumes"
  ),
  "docker compose down --volumes rejected"
);
check(
  "DOCKER-SAFE-005",
  detectDestructiveDockerCleanup("docker-compose down -v").some(
    (f) => f.category === "compose-down-with-volumes"
  ),
  "docker-compose down -v rejected"
);
check(
  "DOCKER-SAFE-006",
  detectDestructiveDockerCleanup("docker volume rm foo").some((f) => f.category === "docker-volume-rm"),
  "docker volume rm rejected"
);
check(
  "DOCKER-SAFE-007",
  detectDestructiveDockerCleanup("docker volume prune -f").some(
    (f) => f.category === "docker-volume-prune"
  ),
  "docker volume prune rejected"
);
check(
  "DOCKER-SAFE-008",
  detectDestructiveDockerCleanup("docker system prune -af").some(
    (f) => f.category === "docker-system-prune"
  ),
  "docker system prune rejected"
);

const multiline = `docker compose -p "$COMPOSE_PROJECT_NAME" --env-file .env.e2e \\
  -f docker-compose.yml -f docker-compose.e2e.yml down --volumes --remove-orphans`;
check(
  "DOCKER-SAFE-009",
  detectDestructiveDockerCleanup(multiline).some((f) => f.category === "compose-down-with-volumes"),
  "multiline YAML/shell continuation cannot bypass detection"
);

check(
  "DOCKER-SAFE-010",
  detectDestructiveDockerCleanup("docker volume ls -q | xargs docker volume rm").some(
    (f) => f.category === "volume-rm-pipeline"
  ),
  "xargs docker volume rm rejected"
);

check(
  "DOCKER-SAFE-011",
  detectDestructiveDockerCleanup(
    'docker compose -p "$COMPOSE_PROJECT_NAME" --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml down --remove-orphans'
  ).length === 0,
  "safe down --remove-orphans passes"
);

const doc = `# Runbook

## Never

- \`docker compose down -v\`
- \`docker volume rm\`
- \`docker system prune\`

## Local

Use down --remove-orphans only.
`;
check(
  "DOCKER-SAFE-012",
  detectDestructiveDockerCleanup(doc, { isMarkdown: true }).length === 0,
  "clearly marked prohibition documentation does not false-positive"
);

if (failed) process.exit(1);
console.log("\nAll nondestructive-docker-cleanup selftests passed.");
