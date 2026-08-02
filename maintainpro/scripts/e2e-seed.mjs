#!/usr/bin/env node
/**
 * Guarded disposable E2E seed. Fails closed unless E2E isolation conditions hold.
 * Prints emails only — never tokens or password values.
 */

import { createRequire } from "node:module";
import { MongoClient, ObjectId } from "mongodb";
import { ADMIN_PERMISSION_KEYS } from "./lib/admin-permission-keys.mjs";
import {
  assertAllE2eGuards,
  loadE2eEnvOnly
} from "./lib/e2e-guards.mjs";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

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

async function ensurePermissions(db, keys, now) {
  const ids = [];
  for (const key of keys) {
    const existing = await db.collection("Permission").findOne({ key });
    if (existing) {
      ids.push(existing._id);
      continue;
    }
    const id = new ObjectId();
    await db.collection("Permission").insertOne({
      _id: id,
      key,
      description: key,
      roleIds: [],
      createdAt: now,
      updatedAt: now
    });
    ids.push(id);
  }
  return ids;
}

async function createRole(db, tenantId, name, permissionIds, now) {
  const id = new ObjectId();
  await db.collection("Role").insertOne({
    _id: id,
    tenantId,
    name,
    permissionIds,
    createdAt: now,
    updatedAt: now
  });
  await db.collection("Permission").updateMany(
    { _id: { $in: permissionIds } },
    { $addToSet: { roleIds: id }, $set: { updatedAt: now } }
  );
  return id;
}

async function createUser(db, { tenantId, email, passwordHash, firstName, lastName, roleId, now }) {
  const id = new ObjectId();
  await db.collection("User").insertOne({
    _id: id,
    tenantId,
    email,
    passwordHash,
    firstName,
    lastName,
    roleId,
    skills: [],
    dailyCapacityHours: 8,
    mustChangePassword: false,
    isActive: true,
    failedLoginAttempts: 0,
    createdAt: now,
    updatedAt: now
  });
  await db.collection("TenantMembership").insertOne({
    _id: new ObjectId(),
    tenantId,
    userId: id,
    membershipRole: name === "ADMIN" ? "ADMIN" : "MEMBER",
    joinedAt: now,
    createdAt: now,
    updatedAt: now
  });
  return id;
}

async function main() {
  loadE2eEnvOnly();
  const runId = (process.env.E2E_RUN_ID || "").trim();
  const dbIdentity = assertAllE2eGuards({ requireRunId: true });
  const password = (process.env.E2E_SEED_PASSWORD || "").trim();
  if (password.length < 12) {
    throw new Error("E2E_SEED_PASSWORD must be at least 12 characters (fixture only).");
  }
  const domain = (process.env.E2E_SEED_EMAIL_DOMAIN || "e2e.maintainpro.test").trim();
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  // Prefer host-mapped URL when seeding from host against published mongo — E2E compose does not publish mongo.
  // Seed runs inside CI after stack is up, typically via docker compose exec api, OR via localhost tunnel.
  // For host-side seed against docker network, E2E_DATABASE_URL_HOST may override.
  const url =
    (process.env.E2E_DATABASE_URL_HOST || "").trim() ||
    dbIdentity.url;
  if (!url) throw new Error("Database URL missing after guards.");

  const client = new MongoClient(url, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db(dbIdentity.databaseName);

  try {
    const marker = `e2e-run:${runId}`;
    const existing = await db.collection("Tenant").findOne({ "metadata.e2eRunId": runId });
    if (existing) {
      console.log(`Seed already present for run ${runId}; refreshing operational markers only.`);
    }

    const allPermKeys = [...new Set(Object.values(ROLE_PERMS).flat())];
    const permissionIds = await ensurePermissions(db, allPermKeys, now);
    const permByKey = {};
    for (const key of allPermKeys) {
      const doc = await db.collection("Permission").findOne({ key });
      permByKey[key] = doc._id;
    }

    async function seedTenant(slug, name, usersSpec, withOps) {
      let tenant = await db.collection("Tenant").findOne({ slug });
      let tenantId = tenant?._id;
      if (!tenant) {
        tenantId = new ObjectId();
        await db.collection("Tenant").insertOne({
          _id: tenantId,
          name,
          slug,
          isActive: true,
          metadata: { e2eRunId: runId, marker },
          createdAt: now,
          updatedAt: now
        });
      }

      const roleIds = {};
      for (const roleName of Object.keys(usersSpec)) {
        const keys = ROLE_PERMS[roleName] || ["dashboard.view"];
        const ids = keys.map((k) => permByKey[k]).filter(Boolean);
        let role = await db.collection("Role").findOne({ tenantId, name: roleName });
        if (!role) {
          roleIds[roleName] = await createRole(db, tenantId, roleName, ids, now);
        } else {
          roleIds[roleName] = role._id;
          // Refresh permission links so Phase gates remain compatible with preserved volumes.
          await db.collection("Role").updateOne(
            { _id: role._id },
            { $set: { permissionIds: ids, updatedAt: now } }
          );
        }
      }

      const users = {};
      for (const [roleName, emailLocal] of Object.entries(usersSpec)) {
        const email = `${emailLocal}.${runId}@${domain}`.toLowerCase();
        let user = await db.collection("User").findOne({ email });
        if (!user) {
          const userId = new ObjectId();
          await db.collection("User").insertOne({
            _id: userId,
            tenantId,
            email,
            passwordHash,
            firstName: roleName,
            lastName: "E2E",
            roleId: roleIds[roleName],
            skills: [],
            dailyCapacityHours: 8,
            mustChangePassword: false,
            isActive: true,
            failedLoginAttempts: 0,
            createdAt: now,
            updatedAt: now
          });
          await db.collection("TenantMembership").insertOne({
            _id: new ObjectId(),
            tenantId,
            userId,
            membershipRole: roleName === "ADMIN" ? "ADMIN" : "MEMBER",
            joinedAt: now,
            createdAt: now,
            updatedAt: now
          });
          users[roleName] = { id: userId, email };
        } else {
          users[roleName] = { id: user._id, email };
        }
        console.log(`seeded user email=${email} role=${roleName}`);
      }

      if (withOps) {
        const deptId = new ObjectId();
        const deptCode = `E2E-${runId}`.slice(0, 20);
        if (!(await db.collection("Department").findOne({ tenantId, code: deptCode }))) {
          await db.collection("Department").insertOne({
            _id: deptId,
            tenantId,
            name: "E2E Department",
            code: deptCode,
            isActive: true,
            createdAt: now,
            updatedAt: now
          });
        }

        const assetTag = `E2E-ASSET-${runId}`;
        let asset = await db.collection("Asset").findOne({ assetTag });
        if (!asset) {
          const assetId = new ObjectId();
          await db.collection("Asset").insertOne({
            _id: assetId,
            tenantId,
            assetTag,
            name: "E2E Pump",
            category: "EQUIPMENT",
            condition: "GOOD",
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now
          });
          asset = { _id: assetId };
        }

        const reg = `E2E-${runId}`.slice(0, 12).toUpperCase();
        if (!(await db.collection("Vehicle").findOne({ registrationNo: reg }))) {
          await db.collection("Vehicle").insertOne({
            _id: new ObjectId(),
            tenantId,
            registrationNo: reg,
            make: "E2E",
            vehicleModel: "Van",
            year: 2024,
            type: "VAN",
            ownershipType: "OWNED",
            status: "AVAILABLE",
            serviceStatus: "ON_SCHEDULE",
            fuelType: "DIESEL",
            createdAt: now,
            updatedAt: now
          });
        }

        const supplierName = `E2E Supplier ${runId}`;
        let supplier = await db.collection("Supplier").findOne({ tenantId, name: supplierName });
        if (!supplier) {
          const supplierId = new ObjectId();
          await db.collection("Supplier").insertOne({
            _id: supplierId,
            tenantId,
            name: supplierName,
            serviceCategories: ["parts"],
            blacklisted: false,
            isActive: true,
            createdAt: now,
            updatedAt: now
          });
          supplier = { _id: supplierId };
        }

        const partNumber = `E2E-PART-${runId}`;
        if (!(await db.collection("SparePart").findOne({ partNumber }))) {
          await db.collection("SparePart").insertOne({
            _id: new ObjectId(),
            tenantId,
            partNumber,
            name: "E2E Filter",
            category: "FILTER",
            unit: "pcs",
            quantityInStock: 25,
            minimumStock: 5,
            reorderPoint: 8,
            unitCost: 12.5,
            supplierId: supplier._id,
            images: [],
            isActive: true,
            createdAt: now,
            updatedAt: now
          });
        }

        return { tenantId, users, assetId: asset._id };
      }

      // Tenant B minimal: admin + asset + work order
      const assetTag = `E2E-B-ASSET-${runId}`;
      let asset = await db.collection("Asset").findOne({ assetTag });
      if (!asset) {
        const assetId = new ObjectId();
        await db.collection("Asset").insertOne({
          _id: assetId,
          tenantId,
          assetTag,
          name: "Tenant B Asset",
          category: "EQUIPMENT",
          condition: "GOOD",
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now
        });
        asset = { _id: assetId };
      }

      const woNumber = `E2E-B-WO-${runId}`;
      if (!(await db.collection("WorkOrder").findOne({ woNumber }))) {
        await db.collection("WorkOrder").insertOne({
          _id: new ObjectId(),
          tenantId,
          woNumber,
          title: "Tenant B WO",
          description: "Isolation target",
          priority: "MEDIUM",
          status: "OPEN",
          approvalStatus: "APPROVED",
          type: "CORRECTIVE",
          assetId: asset._id,
          createdById: users.ADMIN.id,
          createdAt: now,
          updatedAt: now
        });
      }

      const partNumberB = `E2E-B-PART-${runId}`;
      if (!(await db.collection("SparePart").findOne({ partNumber: partNumberB }))) {
        await db.collection("SparePart").insertOne({
          _id: new ObjectId(),
          tenantId,
          partNumber: partNumberB,
          name: "Tenant B Filter",
          category: "FILTER",
          unit: "pcs",
          quantityInStock: 10,
          minimumStock: 2,
          reorderPoint: 4,
          unitCost: 9.5,
          images: [],
          isActive: true,
          createdAt: now,
          updatedAt: now
        });
      }

      return { tenantId, users, assetId: asset._id };
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

    // Cross-membership for tenant switch test: admin-a also member of tenant B? No —
    // Tenant switch requires membership. Give admin-a membership on B for switch tests.
    const existingMembership = await db.collection("TenantMembership").findOne({
      tenantId: tenantB.tenantId,
      userId: tenantA.users.ADMIN.id
    });
    if (!existingMembership) {
      await db.collection("TenantMembership").insertOne({
        _id: new ObjectId(),
        tenantId: tenantB.tenantId,
        userId: tenantA.users.ADMIN.id,
        membershipRole: "MEMBER",
        joinedAt: now,
        createdAt: now,
        updatedAt: now
      });
    }

    console.log("E2E seed complete");
    console.log(`runId=${runId}`);
    console.log(`databaseName=${dbIdentity.databaseName}`);
    console.log(`tenantA=${tenantA.tenantId.toString()}`);
    console.log(`tenantB=${tenantB.tenantId.toString()}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`E2E seed FAILED: ${err.message}`);
  process.exit(1);
});