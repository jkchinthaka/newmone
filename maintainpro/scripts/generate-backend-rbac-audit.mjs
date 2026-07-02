import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiSrc = path.join(root, "apps", "api", "src");
const outputPath = path.join(root, "docs", "go-live", "backend-rbac-audit.md");

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith(".controller.ts")) {
      files.push(full);
    }
  }
  return files;
}

function parseController(filePath) {
  const source = readFileSync(filePath, "utf8");
  const rel = path.relative(apiSrc, filePath).replace(/\\/g, "/");
  const controllerMatch = source.match(/@Controller\(([^)]+)\)/);
  const basePath = controllerMatch
    ? controllerMatch[1].replace(/['"`]/g, "").trim()
    : "unknown";

  const classUseGuards = /@UseGuards\(([^)]+)\)/.test(source.slice(0, source.indexOf("export class") + 200));
  const isPublicClass = /@Public\(\)/.test(source.slice(0, 400));

  const routes = [];
  const methodRegex =
    /@(Get|Post|Patch|Put|Delete)\(([^)]*)\)[\s\S]*?(?=@(?:Get|Post|Patch|Put|Delete)\(|export class|\Z)/g;

  let match;
  while ((match = methodRegex.exec(source)) !== null) {
    const block = match[0];
    const httpMethod = match[1].toUpperCase();
    const routePath = (match[2] || "").replace(/['"`]/g, "").trim();
    const fullPath = `/${basePath}/${routePath}`.replace(/\/+/g, "/").replace(/\/$/, "") || `/${basePath}`;

    const rolesMatch = block.match(/@Roles\(([\s\S]*?)\)/);
    const permissionsMatch = block.match(/@Permissions\(([\s\S]*?)\)/);
    const isPublic = /@Public\(\)/.test(block);

    const roles = rolesMatch
      ? rolesMatch[1]
          .split(",")
          .map((r) => r.replace(/['"`\s]/g, ""))
          .filter(Boolean)
      : [];
    const permissions = permissionsMatch
      ? permissionsMatch[1]
          .split(",")
          .map((p) => p.replace(/['"`\s]/g, ""))
          .filter(Boolean)
      : [];

    const hasJwt = /@UseGuards\([^)]*JwtAuthGuard/.test(block) || classUseGuards;
    const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(httpMethod);
    const highRisk =
      /override|approve|reject|status|stock|invoice|export|role|user|settings|archive|restore|gate/i.test(
        `${fullPath} ${block}`
      );

    let status = "PASS";
    if (isPublic) {
      status = "PASS";
    } else if (!hasJwt && !isPublicClass) {
      status = "TODO";
    } else if (roles.length === 0 && permissions.length === 0 && !isPublic) {
      status = isMutation || highRisk ? "TODO" : "PASS";
    }

    const auditRequired = isMutation || highRisk || /export/i.test(fullPath);

    routes.push({
      method: httpMethod,
      path: fullPath,
      controller: rel,
      roles: roles.length ? roles.join(", ") : "—",
      permissions: permissions.length ? permissions.join(", ") : "—",
      scope: "tenant via JwtAuthGuard + TenantContextGuard",
      auditRequired: auditRequired ? "yes" : "no",
      status: isPublic ? "PASS (public)" : status
    });
  }

  return routes;
}

const allRoutes = walk(apiSrc).flatMap(parseController);
allRoutes.sort((a, b) => `${a.path}${a.method}`.localeCompare(`${b.path}${b.method}`));

const passCount = allRoutes.filter((r) => r.status.startsWith("PASS")).length;
const todoCount = allRoutes.filter((r) => r.status === "TODO").length;
const fixedCount = allRoutes.filter((r) => r.status === "FIXED").length;

const lines = [
  "# Backend RBAC Audit",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "MaintainPro API route protection review for UAT-022. Global guards: `JwtAuthGuard`, `TenantContextGuard`, `RolesGuard`, `PermissionsGuard`.",
  "",
  "## Summary",
  "",
  `| Metric | Count |`,
  `|--------|------:|`,
  `| Total routes scanned | ${allRoutes.length} |`,
  `| PASS | ${passCount} |`,
  `| FIXED | ${fixedCount} |`,
  `| TODO | ${todoCount} |`,
  "",
  "High-risk endpoints (work order status, overrides, parts, invoices, exports, admin) must have `@Roles` and/or `@Permissions`.",
  "",
  "## Route Matrix",
  "",
  "| Endpoint | Method | Controller | Permission | Roles | Scope | Audit | Status |",
  "|----------|--------|------------|------------|-------|-------|-------|--------|"
];

for (const route of allRoutes) {
  lines.push(
    `| \`${route.path}\` | ${route.method} | \`${route.controller}\` | ${route.permissions} | ${route.roles} | ${route.scope} | ${route.auditRequired} | ${route.status} |`
  );
}

lines.push(
  "",
  "## High-Risk Endpoint Checklist",
  "",
  "| Area | Expected guard | Audit | Notes |",
  "|------|----------------|-------|-------|",
  "| Work order status update | `work_orders.update_status` or manager roles | yes | Service writes audit on sensitive transitions |",
  "| Supervisor verification | supervisor/manager roles | yes | Governance service audited |",
  "| Admin override | reason required + audit metadata.overrideFlag | yes | Fraud control report |",
  "| Parts issue/return | `part_requests.issue` / inventory permissions | yes | Maker-checker enforced UAT-020 |",
  "| Stock adjustment | `inventory.manage` | yes | Inventory service audit |",
  "| Vendor/invoice approval | finance + manager permissions | yes | Maker-checker + fraud events |",
  "| Gate-out override | `gate.override.approve` | yes | Gate block audit events |",
  "| User/role management | `users.*` / `roles.manage` | yes | Admin console |",
  "| Report export | manager/finance roles + export audit | yes | CSV export writes `report_exported` |",
  "| Master data update | module manage permissions | yes | Department/asset services |",
  "| Settings update | `settings.*.manage` | yes | Settings service audit |",
  "",
  "## TODO Guidance",
  "",
  "Routes marked TODO lack explicit `@Roles` or `@Permissions` on the handler. Review each endpoint:",
  "- If intentionally self-service (e.g. profile), document exception.",
  "- If tenant-scoped read for all authenticated users, add `@Permissions` view key.",
  "- If mutation, add strict permission before production expansion.",
  "",
  "## Verification",
  "",
  "Re-generate this report:",
  "",
  "```bash",
  "node scripts/generate-backend-rbac-audit.mjs",
  "```",
  ""
);

writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(`backend_rbac_audit=written routes=${allRoutes.length} pass=${passCount} todo=${todoCount}`);
console.log(outputPath);
