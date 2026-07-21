// RBAC / authorization static audit.
//
// Scans every NestJS controller (including farm inline controllers declared in
// *.module.ts) and classifies each HTTP route by authorization scope. Unlike the
// legacy generate-backend-rbac-audit.mjs, this scanner correctly associates ALL
// decorators that precede a handler (multi-line decorators included), so it does
// not produce the historical false-positive TODOs.
//
// Modes:
//   node scripts/audit-rbac.mjs           -> regenerate docs/go-live/backend-rbac-audit.md + print summary
//   node scripts/audit-rbac.mjs --check   -> validate only, exit non-zero on unexcepted violations (CI gate)
//
// A route is "explicitly scoped" when it carries at least one of:
//   @Public()  @Roles(...)  @Permissions(...)  @SelfService()  @TenantScoped()  @PlatformScoped()  @PublicWebhook(...)
//
// Violations (fail CI unless covered by scripts/rbac-audit-exceptions.json):
//   unscoped-route            : authenticated route with no explicit scope
//   platform-without-superadmin: @PlatformScoped route whose @Roles does not include SUPER_ADMIN
//   webhook-without-signature : @Public webhook route missing @PublicWebhook(provider)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiSrc = path.join(root, "apps", "api", "src");
const outputPath = path.join(root, "docs", "go-live", "backend-rbac-audit.md");
const exceptionsPath = path.join(root, "scripts", "rbac-audit-exceptions.json");

const HTTP_DECORATOR = /@(Get|Post|Put|Patch|Delete)\b/;
const HIGH_RISK = /override|approve|reject|status|stock|invoice|export|role|permission|user|settings|archive|restore|gate|adjust|verify|webhook|bulk|payment|refund|delete|switch|invitation|reconcile/i;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) {
      files.push(full);
    }
  }
  return files;
}

function balance(line) {
  let d = 0;
  for (const ch of line) {
    if (ch === "(" || ch === "{" || ch === "[") d++;
    else if (ch === ")" || ch === "}" || ch === "]") d--;
  }
  return d;
}

function extractPath(decoratorText) {
  const m = decoratorText.match(/@(?:Get|Post|Put|Patch|Delete)\(\s*(['"`])([^'"`]*)\1/);
  return m ? m[2] : "";
}

function extractList(decoratorText, name) {
  const m = decoratorText.match(new RegExp(`@${name}\\(([\\s\\S]*?)\\)`));
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.replace(/["'`\s.]/g, "").replace(/RoleName/g, ""))
    .filter(Boolean);
}

function parseFile(filePath) {
  const source = readFileSync(filePath, "utf8");
  if (!source.includes("@Controller(")) return [];
  const rel = path.relative(apiSrc, filePath).replace(/\\/g, "/");
  const lines = source.split(/\r?\n/);

  const routes = [];
  let buffer = [];
  let inDecorator = false;
  let depth = 0;

  let classBasePath = null;
  let classFlags = null;

  const flushClass = () => {
    const text = buffer.join("\n");
    const cm = text.match(/@Controller\(\s*(\[[^\]]*\]|['"`][^'"`]*['"`])/);
    let base = "unknown";
    if (cm) {
      base = cm[1]
        .replace(/[[\]'"`]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", ");
    }
    classBasePath = base;
    classFlags = {
      isPublic: /@Public\(\)/.test(text),
      tenantScoped: /@TenantScoped\(\)/.test(text),
      platformScoped: /@PlatformScoped\(\)/.test(text),
      skipTenant: /@SkipTenantContext\(\)/.test(text),
      hasJwt: /@UseGuards\([^)]*JwtAuthGuard/.test(text)
    };
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (inDecorator) {
      buffer.push(line);
      depth += balance(line);
      if (depth <= 0) inDecorator = false;
      continue;
    }

    if (trimmed.startsWith("@")) {
      buffer.push(line);
      const d = balance(line);
      if (d > 0) {
        inDecorator = true;
        depth = d;
      }
      continue;
    }

    if (trimmed === "") continue;

    // Class declaration: buffer holds class-level decorators.
    if (/\bclass\s+\w+/.test(trimmed) && buffer.some((l) => l.includes("@Controller("))) {
      flushClass();
      buffer = [];
      continue;
    }

    // Handler method: buffer holds its decorators (must include an HTTP verb).
    const methodSig = trimmed.match(
      /^(?:public |private |protected |readonly |static )*(?:async )?([A-Za-z_]\w*)\s*\(/
    );
    if (methodSig && buffer.some((l) => HTTP_DECORATOR.test(l)) && classFlags) {
      const text = buffer.join("\n");
      const httpLine = buffer.find((l) => HTTP_DECORATOR.test(l)) ?? "";
      const method = (httpLine.match(HTTP_DECORATOR) || [])[1].toUpperCase();
      const routePath = extractPath(text);
      const roles = extractList(text, "Roles");
      const permissions = extractList(text, "Permissions");
      const isPublic = classFlags.isPublic || /@Public\(\)/.test(text);
      const selfService = /@SelfService\(\)/.test(text);
      const tenantScoped = classFlags.tenantScoped || /@TenantScoped\(\)/.test(text);
      const platformScoped = classFlags.platformScoped || /@PlatformScoped\(\)/.test(text);
      const webhookMatch = text.match(/@PublicWebhook\(\s*['"`]([^'"`]+)['"`]/);

      const bases = classBasePath.split(",").map((s) => s.trim());
      for (const base of bases) {
        const full =
          `/${base}/${routePath}`.replace(/\/+/g, "/").replace(/\/(?=.)/g, "/").replace(/\/$/, "") ||
          `/${base}`;
        routes.push({
          method,
          path: full,
          controller: rel,
          roles,
          permissions,
          isPublic,
          selfService,
          tenantScoped,
          platformScoped,
          webhookProvider: webhookMatch ? webhookMatch[1] : null,
          highRisk: HIGH_RISK.test(`${full} ${text}`)
        });
      }
    }
    buffer = [];
  }

  return routes;
}

function classify(r) {
  if (r.isPublic) return r.webhookProvider ? "public-webhook" : "public";
  if (r.platformScoped) return "platform";
  if (r.selfService) return "self-service";
  if (r.roles.length || r.permissions.length) return r.tenantScoped ? "tenant" : "tenant";
  if (r.tenantScoped) return "tenant";
  return "unscoped";
}

function violationsFor(r) {
  const out = [];
  const scoped =
    r.isPublic ||
    r.selfService ||
    r.tenantScoped ||
    r.platformScoped ||
    r.roles.length > 0 ||
    r.permissions.length > 0;

  if (!r.isPublic && !scoped) {
    out.push("unscoped-route");
  }
  if (r.platformScoped && !r.roles.map((x) => x.toUpperCase()).includes("SUPER_ADMIN")) {
    out.push("platform-without-superadmin");
  }
  if (r.isPublic && /webhook/i.test(r.path) && !r.webhookProvider) {
    out.push("webhook-without-signature");
  }
  return out;
}

function loadExceptions() {
  if (!existsSync(exceptionsPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(exceptionsPath, "utf8"));
    return Array.isArray(parsed.exceptions) ? parsed.exceptions : [];
  } catch {
    return [];
  }
}

const isCheck = process.argv.includes("--check");
const allRoutes = walk(apiSrc).flatMap(parseFile);
allRoutes.sort((a, b) => `${a.path}${a.method}`.localeCompare(`${b.path}${b.method}`));

const exceptions = loadExceptions();
const now = new Date();
const exceptionMatch = (r, v) =>
  exceptions.find((e) => {
    if (e.route !== `${r.method} ${r.path}`) return false;
    if (e.violation && e.violation !== v) return false;
    if (e.expiry && new Date(e.expiry) < now) return false;
    return true;
  });

let failing = [];
let excepted = [];
for (const r of allRoutes) {
  for (const v of violationsFor(r)) {
    if (exceptionMatch(r, v)) excepted.push({ r, v });
    else failing.push({ r, v });
  }
}

const highRiskFailing = failing.filter((f) => f.r.highRisk);
const scopeCounts = allRoutes.reduce((acc, r) => {
  const c = classify(r);
  acc[c] = (acc[c] || 0) + 1;
  return acc;
}, {});

function summary() {
  console.log("=== RBAC / authorization audit ===");
  console.log(`routes_scanned=${allRoutes.length}`);
  for (const [k, v] of Object.entries(scopeCounts).sort()) {
    console.log(`  scope:${k}=${v}`);
  }
  console.log(`violations=${failing.length} excepted=${excepted.length} high_risk_todo=${highRiskFailing.length}`);
  for (const f of failing) {
    console.log(`  VIOLATION [${f.v}] ${f.r.method} ${f.r.path} (${f.r.controller})`);
  }
}

if (isCheck) {
  summary();
  if (failing.length > 0) {
    console.error(
      `\naudit:rbac FAILED with ${failing.length} unexcepted violation(s) (${highRiskFailing.length} high-risk).`
    );
    console.error("Add explicit scope (@Roles/@Permissions/@SelfService/@TenantScoped/@PlatformScoped/@Public+@PublicWebhook) or register a reviewed exception in scripts/rbac-audit-exceptions.json.");
    process.exit(1);
  }
  console.log("\naudit:rbac PASSED: every route is explicitly scoped.");
  process.exit(0);
}

// Write mode: regenerate the route matrix document.
function statusFor(r) {
  const vs = violationsFor(r);
  const unexcepted = vs.filter((v) => !exceptionMatch(r, v));
  if (unexcepted.length) return `TODO (${unexcepted.join(", ")})`;
  if (vs.length) return "EXCEPTION";
  if (r.isPublic) return r.webhookProvider ? `PASS (webhook:${r.webhookProvider})` : "PASS (public)";
  if (r.selfService) return "PASS (self-service)";
  if (r.platformScoped) return "PASS (platform)";
  return "PASS";
}

const lines = [
  "# Backend RBAC Audit",
  "",
  `Generated: ${now.toISOString()} by scripts/audit-rbac.mjs`,
  "",
  "MaintainPro API route authorization review. Global guards: `JwtAuthGuard`, `TenantContextGuard`, `RolesGuard`, `PermissionsGuard`.",
  "This report is regenerated by `npm run audit:rbac:report`; CI enforces it via `npm run audit:rbac` (check mode).",
  "",
  "## Summary",
  "",
  "| Metric | Count |",
  "|--------|------:|",
  `| Total routes scanned | ${allRoutes.length} |`,
  `| Explicitly scoped (PASS) | ${allRoutes.length - failing.length} |`,
  `| Reviewed exceptions | ${excepted.length} |`,
  `| Unresolved (TODO) | ${failing.length} |`,
  `| High-risk TODO | ${highRiskFailing.length} |`,
  "",
  "### Scope distribution",
  "",
  "| Scope | Count |",
  "|-------|------:|",
  ...Object.entries(scopeCounts)
    .sort()
    .map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## Route Matrix",
  "",
  "| Endpoint | Method | Controller | Permissions | Roles | Scope | High-risk | Status |",
  "|----------|--------|------------|-------------|-------|-------|-----------|--------|"
];

for (const r of allRoutes) {
  lines.push(
    `| \`${r.path}\` | ${r.method} | \`${r.controller}\` | ${
      r.permissions.length ? r.permissions.join(", ") : "—"
    } | ${r.roles.length ? r.roles.join(", ") : "—"} | ${classify(r)} | ${
      r.highRisk ? "yes" : "no"
    } | ${statusFor(r)} |`
  );
}

lines.push(
  "",
  "## Scope legend",
  "",
  "- **public** — unauthenticated transport (`@Public()`). Must not expose business data.",
  "- **public-webhook** — unauthenticated integration webhook (`@Public()` + `@PublicWebhook(provider)`); authenticated by provider signature.",
  "- **self-service** — authenticated route acting only on the caller's own resources (`@SelfService()`).",
  "- **tenant** — tenant-scoped business route (`@Roles`/`@Permissions`, optionally `@TenantScoped()`).",
  "- **platform** — SUPER_ADMIN platform/administration route (`@PlatformScoped()` + `@Roles('SUPER_ADMIN')`).",
  "- **unscoped** — authenticated route with no explicit scope (violation).",
  "",
  "## Verification",
  "",
  "```bash",
  "npm run audit:rbac          # CI gate (check mode, exits non-zero on violations)",
  "npm run audit:rbac:report   # regenerate this document",
  "```",
  ""
);

writeFileSync(outputPath, lines.join("\n"), "utf8");
summary();
console.log(`\nbackend_rbac_audit=written path=${outputPath}`);
