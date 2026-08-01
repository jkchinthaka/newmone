#!/usr/bin/env node
/**
 * Self-tests for text integrity (TEXT-SAFE-001..013).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_CLEANUP_FIX_SHA,
  EXPECTED_VALIDATOR_COMMAND,
  analyzeTextIntegrity,
  findForbiddenControlCharacters,
  scanRepositoryTextIntegrity
} from "../validate-text-integrity.mjs";

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

check("TEXT-SAFE-001", findForbiddenControlCharacters("hello\nworld\n").length === 0, "normal LF text passes");
check("TEXT-SAFE-002", findForbiddenControlCharacters("col1\tcol2\n").length === 0, "TAB passes");
check("TEXT-SAFE-003", findForbiddenControlCharacters("hello\r\nworld\r\n").length === 0, "CRLF text passes");

check(
  "TEXT-SAFE-004",
  findForbiddenControlCharacters(`bad\u000Ctext`).some((f) => f.codePoint === "U+000C"),
  "form-feed U+000C rejected"
);
check(
  "TEXT-SAFE-005",
  findForbiddenControlCharacters(`bad\u000Btext`).some((f) => f.codePoint === "U+000B"),
  "vertical-tab U+000B rejected"
);
check(
  "TEXT-SAFE-006",
  findForbiddenControlCharacters(`bad\u0000text`).some((f) => f.codePoint === "U+0000"),
  "NUL U+0000 rejected"
);
check(
  "TEXT-SAFE-007",
  findForbiddenControlCharacters(`bad\u007Ftext`).some((f) => f.codePoint === "U+007F"),
  "DEL U+007F rejected"
);
check(
  "TEXT-SAFE-008",
  findForbiddenControlCharacters(`bad\uFFFDtext`).some((f) => f.codePoint === "U+FFFD"),
  "replacement U+FFFD rejected"
);

check(
  "TEXT-SAFE-009",
  analyzeTextIntegrity(`sha f\u000Ce3b3992d883d33c916b3595769add2c4db8878a`).some(
    (f) => f.category === "split-commit-sha" || f.category === "forbidden-control"
  ),
  "control character splitting a commit SHA is rejected"
);

check(
  "TEXT-SAFE-010",
  analyzeTextIntegrity(`run \u000Balidate:nondestructive-docker-cleanup`).some(
    (f) => f.category === "split-npm-command" || f.category === "forbidden-control"
  ),
  "control character removing first char of npm command is rejected"
);

const remFindings = scanRepositoryTextIntegrity({
  targets: undefined
})
  .filter((f) => f.file.replace(/\\/g, "/").includes("/docs/remediation/"));
check("TEXT-SAFE-011", remFindings.length === 0, "remediation documentation has zero findings");

const evidence = readFileSync(
  path.join(repoRoot, "maintainpro/docs/remediation/FULL_STACK_E2E_RUNTIME_EVIDENCE.md"),
  "utf8"
);
check(
  "TEXT-SAFE-012",
  evidence.includes(EXPECTED_CLEANUP_FIX_SHA),
  "exact cleanup-fix SHA appears in runtime evidence"
);

const limitations = readFileSync(
  path.join(repoRoot, "maintainpro/docs/remediation/FULL_STACK_E2E_KNOWN_LIMITATIONS.md"),
  "utf8"
);
check(
  "TEXT-SAFE-013",
  limitations.includes(EXPECTED_VALIDATOR_COMMAND),
  "exact validator command appears in limitations document"
);

if (failed) process.exit(1);
console.log("\nAll text-integrity selftests passed.");
