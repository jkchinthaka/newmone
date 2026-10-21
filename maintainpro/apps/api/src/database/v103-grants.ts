import type { PrismaClient } from "@prisma/client";

export const V103_REQUEST_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "SECURITY_OFFICER",
  "INVENTORY_KEEPER"
] as const;

export const V103_CREATE_PERMISSION = "maintenance_requests.create";

const FINANCE_ONLY_ROLES = new Set(["FINANCE", "FINANCE_APPROVER"]);

/**
 * Adds the request permission and MANAGER+ADMIN approver levels.
 * Never deletes a permission or an existing approver level.
 * Does not insert a catch-all approval rule: an empty condition matches every job.
 */
export async function applyV103Grants(prisma: PrismaClient, options: { dryRun: boolean }) {
  const lines: string[] = [];
  let permission = await prisma.permission.findUnique({ where: { key: V103_CREATE_PERMISSION } });
  if (!permission) {
    lines.push(`CREATE permission ${V103_CREATE_PERMISSION}`);
    if (!options.dryRun) {
      permission = await prisma.permission.create({
        data: { key: V103_CREATE_PERMISSION, description: V103_CREATE_PERMISSION }
      });
    }
  } else {
    lines.push(`KEEP permission ${V103_CREATE_PERMISSION}`);
  }

  const roles = await prisma.role.findMany({
    where: { name: { in: [...V103_REQUEST_ROLES] } },
    select: { id: true, name: true, tenantId: true }
  });
  for (const role of roles) {
    if (!permission) {
      lines.push(`GRANT ${V103_CREATE_PERMISSION} to ${role.name} (${role.tenantId ?? "platform"})`);
      continue;
    }
    const existing = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId: permission.id }
    });
    if (existing) {
      lines.push(`KEEP ${V103_CREATE_PERMISSION} on ${role.name} (${role.tenantId ?? "platform"})`);
      continue;
    }
    lines.push(`GRANT ${V103_CREATE_PERMISSION} to ${role.name} (${role.tenantId ?? "platform"})`);
    if (!options.dryRun) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id }
      });
    }
  }

  const rules = await prisma.approvalRule.findMany({
    where: { isActive: true },
    include: { levels: true }
  });
  for (const rule of rules) {
    const approverRoles = rule.levels.map((level) => level.approverRole).filter((role): role is string => Boolean(role));
    const financeOnly = approverRoles.length > 0 && approverRoles.every((role) => FINANCE_ONLY_ROLES.has(role));
    const missingLevels = approverRoles.length === 0;
    if (!financeOnly && !missingLevels) {
      lines.push(`KEEP approvers on ${rule.name}`);
      continue;
    }
    const used = new Set(rule.levels.map((level) => level.level));
    let next = 1;
    const takeLevel = () => {
      while (used.has(next)) next += 1;
      const level = next;
      used.add(level);
      next += 1;
      return level;
    };
    for (const approverRole of ["MANAGER", "ADMIN"] as const) {
      if (approverRoles.includes(approverRole)) continue;
      const level = takeLevel();
      lines.push(`ADD ${approverRole} level ${level} on ${rule.name}`);
      if (!options.dryRun) {
        await prisma.approvalRuleLevel.create({
          data: { tenantId: rule.tenantId, ruleId: rule.id, level, approverRole }
        });
      }
    }
  }

  return lines;
}
