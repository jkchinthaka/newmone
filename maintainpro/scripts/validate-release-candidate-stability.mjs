#!/usr/bin/env node
/**
 * Structural validator: Phase 7A release-candidate auth redirect stability.
 * Never prints secrets.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(maintainproRoot, "..");

let failures = 0;
let passes = 0;

function pass(id, msg) {
  passes += 1;
  console.log(`PASS ${id}: ${msg}`);
}
function fail(id, msg) {
  failures += 1;
  console.error(`FAIL ${id}: ${msg}`);
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function extractAuth012(src) {
  const marker = "E2E-AUTH-012 protected page redirects after logout";
  const start = src.indexOf(marker);
  if (start < 0) return "";
  const rest = src.slice(start);
  const next = rest.search(/\n\s*test\(/);
  return next > 0 ? rest.slice(0, next) : rest.slice(0, 3500);
}

function main() {
  console.log("validate:release-candidate-stability — structural checks only\n");

  const authPath = path.join(maintainproRoot, "apps/web/e2e-real/auth.spec.ts");
  const helperPath = path.join(
    maintainproRoot,
    "apps/web/e2e-real/helpers/protected-navigation.ts"
  );
  const workflowPath = path.join(repoRoot, ".github/workflows/full-stack-e2e.yml");
  const pkgPath = path.join(maintainproRoot, "package.json");
  const decisionReport = path.join(maintainproRoot, "docs/uat/FINAL_GO_NO_GO_REPORT.md");

  if (!existsSync(authPath)) {
    fail("RC-STAB-001", "auth.spec.ts missing");
  } else {
    const authRaw = readFileSync(authPath, "utf8");
    const auth = stripComments(authRaw);
    const auth012 = extractAuth012(auth);

    if (!auth012) {
      fail("RC-STAB-001", "E2E-AUTH-012 missing");
    } else {
      pass("RC-STAB-001", "E2E-AUTH-012 present");
    }

    if (/test\.skip|test\.fixme/.test(auth012)) {
      fail("RC-STAB-002", "E2E-AUTH-012 must not use test.skip or test.fixme");
    } else {
      pass("RC-STAB-002", "E2E-AUTH-012 has no skip/fixme");
    }

    if (
      /\.catch\(\s*\(\)\s*=>\s*(?:undefined|null|\{\s*\})\s*\)/.test(auth012) ||
      /\[200,\s*201,\s*204\]/.test(auth012)
    ) {
      fail("RC-STAB-003", "AUTH-012 must not broadly swallow exceptions or loosen status");
    } else {
      pass("RC-STAB-003", "AUTH-012 avoids broad swallow/status looseness");
    }

    if (
      !/maintainpro_access/.test(auth012) ||
      !/accessGone|cookieNamesPresent|readCookieMap/.test(auth012)
    ) {
      fail("RC-STAB-011", "cookie/session clearing must remain tested in AUTH-012");
    } else {
      pass("RC-STAB-011", "cookie/session clearing remains tested");
    }

    if (!/navigateToProtectedRouteAndExpectLogin/.test(auth012)) {
      fail("RC-STAB-008a", "AUTH-012 must use deterministic protected navigation helper");
    } else {
      pass("RC-STAB-008a", "AUTH-012 uses deterministic navigation helper");
    }
  }

  if (!existsSync(workflowPath)) {
    fail("RC-STAB-004", "full-stack-e2e.yml missing");
  } else {
    const wf = readFileSync(workflowPath, "utf8");
    const gateIdx = wf.search(/Release-candidate auth stability gate/i);
    if (gateIdx < 0 && !/release-candidate-auth-stability-gate/.test(wf)) {
      fail("RC-STAB-004", "focused release-candidate auth stability gate missing in workflow");
    } else {
      pass("RC-STAB-004", "focused workflow gate present");
    }

    const gateSection =
      gateIdx >= 0 ? wf.slice(gateIdx, gateIdx + 1500) : wf;

    if (!/--retries=0/.test(gateSection) || !/E2E-AUTH-012/.test(gateSection)) {
      fail("RC-STAB-005", "focused gate must use --retries=0 and grep E2E-AUTH-012");
    } else {
      pass("RC-STAB-005", "focused gate uses --retries=0");
    }

    if (!/chromium-desktop/.test(gateSection) || !/mobile-smoke/.test(gateSection)) {
      fail("RC-STAB-006", "focused gate must include chromium-desktop and mobile-smoke");
    } else {
      pass("RC-STAB-006", "desktop and mobile projects included");
    }

    if (!/--repeat-each=\d+/.test(gateSection)) {
      fail("RC-STAB-007", "focused gate must configure repeat-each");
    } else {
      pass("RC-STAB-007", "repeat execution configured");
    }

    if (/phase\s*8.*(deploy|cutover|go-live|release)/i.test(wf)) {
      fail("RC-STAB-013", "Phase 8 deployment command introduced");
    } else {
      pass("RC-STAB-013", "no Phase 8 deployment command introduced");
    }
  }

  if (!existsSync(helperPath)) {
    fail("RC-STAB-008", "protected-navigation helper missing");
  } else {
    const helperRaw = readFileSync(helperPath, "utf8");
    const helper = stripComments(helperRaw);

    if (!/toHaveURL\(\s*\/\\\/login\(\?:\\\?\|\$\)\//.test(helper)) {
      fail("RC-STAB-008", "final URL assertion must target /login");
    } else {
      pass("RC-STAB-008", "final URL assertion targets /login");
    }

    if (!/#login-email/.test(helper) || !/sign in/i.test(helper)) {
      fail("RC-STAB-009", "login UI visibility must be asserted");
    } else {
      pass("RC-STAB-009", "login UI visibility asserted");
    }

    if (!/work order/i.test(helper) || !/\.not\.toBeVisible\(/.test(helper)) {
      fail("RC-STAB-010", "protected content absence must be asserted");
    } else {
      pass("RC-STAB-010", "protected content absence asserted");
    }

    if (/\.catch\(\s*\(\)\s*=>\s*(?:undefined|null|\{\s*\})\s*\)/.test(helper)) {
      fail("RC-STAB-003b", "helper must not broadly swallow exceptions");
    } else if (!/ERR_ABORTED/.test(helper) || !/throw error/.test(helper)) {
      fail("RC-STAB-003b", "helper must re-throw non-ERR_ABORTED failures");
    } else {
      pass("RC-STAB-003b", "helper only allows expected ERR_ABORTED");
    }
  }

  if (existsSync(decisionReport)) {
    const report = readFileSync(decisionReport, "utf8");
    if (!/DELAYED/.test(report) || /\|\s*Recommendation\s*\|\s*\*\*GO\*\*/.test(report)) {
      fail("RC-STAB-012", "Phase 7 recommendation must remain DELAYED");
    } else {
      pass("RC-STAB-012", "Phase 7 recommendation remains DELAYED");
    }
  } else {
    fail("RC-STAB-012", "FINAL_GO_NO_GO_REPORT.md missing");
  }

  if (existsSync(pkgPath)) {
    const pkg = readFileSync(pkgPath, "utf8");
    if (!/"validate:release-candidate-stability"/.test(pkg)) {
      fail("RC-STAB-014", "package script validate:release-candidate-stability missing");
    } else {
      pass("RC-STAB-014", "package script present");
    }
  }

  console.log(`\nSummary: ${passes} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

main();