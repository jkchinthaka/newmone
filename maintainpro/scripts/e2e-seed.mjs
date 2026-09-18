#!/usr/bin/env node
/**
 * Guarded disposable E2E seed against SQL Server via Prisma.
 * Fails closed unless E2E isolation conditions hold.
 * Prints emails only — never tokens or password values.
 */

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { ADMIN_PERMISSION_KEYS } from "./lib/admin-permission-keys.mjs";
import {
  assertAllE2eGuards,
  loadE2eEnvOnly
} from "./lib/e2e-guards.mjs";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

/** SQL Server NVarChar(36) ids — compatible with existing CUID-length columns. */
function newId() {
  return randomUUID();
}

const ROLE_PERMS = {
  ADMIN: ADMIN_PERMISSION_KEYS,
  MANAGER: [
    "dashboard.view",
    "assets.manage",
    "work_orders.manage",
    "work_orders.update_status",
    "work_orders.view_own",
    "inventory.manage",
    "inventory.stock_issue",
    "purchase_orders.view",
    "purchase_orders.approve_operational",
    "purchase_orders.approve_finance",
    "purchase_orders.reject",
    "purchase_orders.erp_sync",
    "purchase_orders.erp_sync_retry",
    "part_requests.view",
    "part_requests.approve_operational",
    "part_requests.approve_finance",
    "audit.view",
    "reports.view",
    "reports.operations.view",
    "reports.financials.view",
    "reports.user_activity.view",
    "reports.assets.view",
    "reports.inventory.view",
    "reports.performance.view",
    "reports.driver_intelligence.view",
    "reports.fuel.view",
    "reports.vehicle_cost.view",
    "reports.export",
    "reports.management.view"
  ],
  TECHNICIAN: [
    "dashboard.view",
    "work_orders.view_own",
    "work_orders.update_status",
    "inventory.manage",
    "reports.operations.view",
    "reports.performance.view"
  ],
  SECURITY_OFFICER: ["dashboard.view", "gate.in.create", "gate.out.create"],
  INVENTORY_KEEPER: [
    "dashboard.view",
    "inventory.manage",
    "inventory.stock_issue",
    "inventory.erp_dry_run",
    "purchase_orders.view",
    "purchase_orders.receive",
    "part_requests.view",
    "part_requests.approve_operational",
    "part_requests.issue",
    "work_orders.view_own",
    "reports.inventory.view",
    "reports.operations.view"
  ]
};

async function ensurePermissions(prisma, keys) {
  const permByKey = {};
  for (const key of keys) {
    const existing = await prisma.permission.findUnique({ where: { key } });
    if (existing) {
      permByKey[key] = existing.id;
      continue;
    }
    const created = await prisma.permission.create({
      data: { id: newId(), key, description: `E2E ${key}` }
    });
    permByKey[key] = created.id;
  }
  return permByKey;
}

async function ensureRole(prisma, tenantId, roleName, permissionIds) {
  let role = await prisma.role.findFirst({ where: { tenantId, name: roleName } });
  if (!role) {
    role = await prisma.role.create({
      data: { id: newId(), tenantId, name: roleName }
    });
  }

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        id: newId(),
        roleId: role.id,
        permissionId
      }))
    });
  }
  return role.id;
}

async function main() {
  loadE2eEnvOnly();
  const runId = (process.env.E2E_RUN_ID || "").trim();
  const dbIdentity = assertAllE2eGuards({ requireRunId: true });
  if (dbIdentity.provider !== "sqlserver") {
    throw new Error("E2E seed requires SQL Server DATABASE_URL / E2E_DATABASE_URL_HOST.");
  }

  const password = (process.env.E2E_SEED_PASSWORD || "").trim();
  if (password.length < 12) {
    throw new Error("E2E_SEED_PASSWORD must be at least 12 characters (fixture only).");
  }
  const domain = (process.env.E2E_SEED_EMAIL_DOMAIN || "e2e.maintainpro.test").trim();
  const passwordHash = await bcrypt.hash(password, 10);

  const url =
    (process.env.E2E_DATABASE_URL_HOST || "").trim() ||
    dbIdentity.url;
  if (!url || !/^sqlserver:\/\//i.test(url)) {
    throw new Error("E2E SQL Server URL missing after guards.");
  }

  process.env.DATABASE_URL = url;
  process.env.DATABASE_PROVIDER = "sqlserver";

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();

    const allPermKeys = [...new Set(Object.values(ROLE_PERMS).flat())];
    const permByKey = await ensurePermissions(prisma, allPermKeys);

    async function seedTenant(slug, name, usersSpec, withOps) {
      let tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: { id: newId(), name, slug, isActive: true }
        });
      }
      const tenantId = tenant.id;

      const roleIds = {};
      for (const roleName of Object.keys(usersSpec)) {
        const keys = ROLE_PERMS[roleName] || ["dashboard.view"];
        const ids = keys.map((k) => permByKey[k]).filter(Boolean);
        roleIds[roleName] = await ensureRole(prisma, tenantId, roleName, ids);
      }

      const users = {};
      for (const [roleName, emailLocal] of Object.entries(usersSpec)) {
        const email = `${emailLocal}.${runId}@${domain}`.toLowerCase();
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              id: newId(),
              tenantId,
              email,
              passwordHash,
              firstName: roleName,
              lastName: "E2E",
              roleId: roleIds[roleName],
              dailyCapacityHours: 8,
              mustChangePassword: false,
              isActive: true,
              failedLoginAttempts: 0
            }
          });
          await prisma.tenantMembership.create({
            data: {
              id: newId(),
              tenantId,
              userId: user.id,
              membershipRole: roleName === "ADMIN" ? "ADMIN" : "MEMBER"
            }
          });
        }
        users[roleName] = { id: user.id, email };
        console.log(`seeded user email=${email} role=${roleName}`);
      }

      if (withOps) {
        const deptCode = `E2E-${runId}`.slice(0, 20);
        let department = await prisma.department.findFirst({
          where: { tenantId, code: deptCode }
        });
        if (!department) {
          department = await prisma.department.create({
            data: {
              id: newId(),
              tenantId,
              name: "E2E Department",
              code: deptCode,
              isActive: true
            }
          });
        }

        const assetTag = `E2E-ASSET-${runId}`.slice(0, 64);
        let asset = await prisma.asset.findFirst({ where: { tenantId, assetTag } });
        if (!asset) {
          asset = await prisma.asset.create({
            data: {
              id: newId(),
              tenantId,
              assetTag,
              name: "E2E Pump",
              category: "EQUIPMENT",
              condition: "GOOD",
              status: "ACTIVE",
              departmentId: department.id,
              images: "[]",
              documents: "[]"
            }
          });
        }

        const reg = `E2E-${runId}`.slice(0, 12).toUpperCase();
        const existingVehicle = await prisma.vehicle.findFirst({
          where: { tenantId, registrationNo: reg }
        });
        if (!existingVehicle) {
          await prisma.vehicle.create({
            data: {
              id: newId(),
              tenantId,
              registrationNo: reg,
              make: "E2E",
              vehicleModel: "Van",
              year: 2024,
              type: "VAN",
              ownershipType: "OWNED",
              status: "AVAILABLE",
              serviceStatus: "ON_SCHEDULE",
              fuelType: "DIESEL"
            }
          });
        }

        const supplierName = `E2E Supplier ${runId}`;
        let supplier = await prisma.supplier.findFirst({
          where: { tenantId, name: supplierName }
        });
        if (!supplier) {
          supplier = await prisma.supplier.create({
            data: {
              id: newId(),
              tenantId,
              name: supplierName,
              serviceCategories: JSON.stringify(["parts"]),
              blacklisted: false,
              isActive: true
            }
          });
        }

        const partNumber = `E2E-PART-${runId}`.slice(0, 64);
        const existingPart = await prisma.sparePart.findFirst({
          where: { tenantId, partNumber }
        });
        if (!existingPart) {
          await prisma.sparePart.create({
            data: {
              id: newId(),
              tenantId,
              partNumber,
              name: "E2E Filter",
              category: "FILTER",
              classification: "SPARE_PART",
              unit: "pcs",
              quantityInStock: 25,
              reservedQuantity: 0,
              availableQuantity: 25,
              minimumStock: 5,
              reorderPoint: 8,
              unitCost: 12.5,
              supplierId: supplier.id,
              images: "[]",
              isActive: true
            }
          });
        }

        return { tenantId, users, assetId: asset.id };
      }

      const assetTag = `E2E-B-ASSET-${runId}`.slice(0, 64);
      let asset = await prisma.asset.findFirst({ where: { tenantId, assetTag } });
      if (!asset) {
        asset = await prisma.asset.create({
          data: {
            id: newId(),
            tenantId,
            assetTag,
            name: "Tenant B Asset",
            category: "EQUIPMENT",
            condition: "GOOD",
            status: "ACTIVE",
            images: "[]",
            documents: "[]"
          }
        });
      }

      const woNumber = `E2E-B-WO-${runId}`.slice(0, 64);
      const existingWo = await prisma.workOrder.findFirst({
        where: { tenantId, woNumber }
      });
      if (!existingWo) {
        await prisma.workOrder.create({
          data: {
            id: newId(),
            tenantId,
            woNumber,
            title: "Tenant B WO",
            description: "Isolation target",
            priority: "MEDIUM",
            status: "OPEN",
            approvalStatus: "APPROVED",
            type: "CORRECTIVE",
            assetId: asset.id,
            createdById: users.ADMIN.id
          }
        });
      }

      const partNumberB = `E2E-B-PART-${runId}`.slice(0, 64);
      const existingPartB = await prisma.sparePart.findFirst({
        where: { tenantId, partNumber: partNumberB }
      });
      if (!existingPartB) {
        await prisma.sparePart.create({
          data: {
            id: newId(),
            tenantId,
            partNumber: partNumberB,
            name: "Tenant B Filter",
            category: "FILTER",
            classification: "SPARE_PART",
            unit: "pcs",
            quantityInStock: 10,
            reservedQuantity: 0,
            availableQuantity: 10,
            minimumStock: 2,
            reorderPoint: 4,
            unitCost: 9.5,
            images: "[]",
            isActive: true
          }
        });
      }

      return { tenantId, users, assetId: asset.id };
    }

    const tenantA = await seedTenant(
      `e2e-a-${runId}`.toLowerCase(),
      `E2E Tenant A ${runId}`,
      {
        ADMIN: "admin-a",
        MANAGER: "manager-a",
        TECHNICIAN: "tech-a",
        SECURITY_OFFICER: "security-a",
        INVENTORY_KEEPER: "inventory-a"
      },
      true
    );

    const tenantB = await seedTenant(
      `e2e-b-${runId}`.toLowerCase(),
      `E2E Tenant B ${runId}`,
      { ADMIN: "admin-b" },
      false
    );

    const existingMembership = await prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenantB.tenantId,
          userId: tenantA.users.ADMIN.id
        }
      }
    });
    if (!existingMembership) {
      await prisma.tenantMembership.create({
        data: {
          id: newId(),
          tenantId: tenantB.tenantId,
          userId: tenantA.users.ADMIN.id,
          membershipRole: "MEMBER"
        }
      });
    }

    console.log("E2E seed complete");
    console.log(`runId=${runId}`);
    console.log(`databaseName=${dbIdentity.databaseName}`);
    console.log(`tenantA=${tenantA.tenantId}`);
    console.log(`tenantB=${tenantB.tenantId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`E2E seed FAILED: ${err.message}`);
  process.exit(1);
});
