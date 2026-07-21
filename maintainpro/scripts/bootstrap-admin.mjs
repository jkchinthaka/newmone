#!/usr/bin/env node
/**
 * Optional post-reset bootstrap: one tenant + one SUPER_ADMIN + min roles/permissions.
 *
 * Required:
 *   BOOTSTRAP_ADMIN_ENABLED=true
 *   CONFIRM_BOOTSTRAP_ADMIN=CREATE_SINGLE_SUPER_ADMIN
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD  (min 12 chars)
 *   BOOTSTRAP_TENANT_NAME
 *   BOOTSTRAP_TENANT_SLUG
 *
 * Does not create sample operational records. Does not run unless explicitly enabled.
 */
import { createRequire } from "node:module";
import { MongoClient, ObjectId } from "mongodb";
import { ADMIN_PERMISSION_KEYS } from "./lib/admin-permission-keys.mjs";
import {
  loadMaintainProEnv,
  printRedactedIdentity,
  resolveDatabaseTarget
} from "./lib/database-identity.mjs";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

function requireEnv(name) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

async function main() {
  loadMaintainProEnv();

  if ((process.env.BOOTSTRAP_ADMIN_ENABLED || "").trim() !== "true") {
    throw new Error("Refusing bootstrap: set BOOTSTRAP_ADMIN_ENABLED=true");
  }
  if ((process.env.CONFIRM_BOOTSTRAP_ADMIN || "").trim() !== "CREATE_SINGLE_SUPER_ADMIN") {
    throw new Error(
      "Refusing bootstrap: CONFIRM_BOOTSTRAP_ADMIN must be CREATE_SINGLE_SUPER_ADMIN"
    );
  }

  const email = requireEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const tenantName = requireEnv("BOOTSTRAP_TENANT_NAME");
  const tenantSlug = requireEnv("BOOTSTRAP_TENANT_SLUG").toLowerCase();
  const firstName = (process.env.BOOTSTRAP_ADMIN_FIRST_NAME || "Platform").trim();
  const lastName = (process.env.BOOTSTRAP_ADMIN_LAST_NAME || "Admin").trim();

  if (password.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");
  }
  if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
    throw new Error("BOOTSTRAP_TENANT_SLUG must be lowercase alphanumeric with hyphens");
  }

  const target = resolveDatabaseTarget();
  printRedactedIdentity(target);
  if (!target.urlPresent || target.databaseName === "unknown") {
    throw new Error("Database identity unknown — refusing bootstrap");
  }
  if (target.classification === "production") {
    throw new Error("Refusing bootstrap against production classification without separate ops runbook");
  }

  const client = new MongoClient(target.url, { maxPoolSize: 3 });
  await client.connect();
  const db = client.db(target.databaseName);
  const now = new Date();

  try {
    const existingUsers = await db.collection("User").countDocuments({});
    const existingTenants = await db.collection("Tenant").countDocuments({});
    if (existingUsers > 0 || existingTenants > 0) {
      throw new Error(
        `Refusing bootstrap: database not empty (users=${existingUsers}, tenants=${existingTenants}). Reset first or clear manually.`
      );
    }

    const tenantId = new ObjectId();
    await db.collection("Tenant").insertOne({
      _id: tenantId,
      name: tenantName,
      slug: tenantSlug,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    const permissionIds = [];
    for (const key of ADMIN_PERMISSION_KEYS) {
      const id = new ObjectId();
      permissionIds.push(id);
      await db.collection("Permission").insertOne({
        _id: id,
        key,
        description: key,
        roleIds: [],
        createdAt: now,
        updatedAt: now
      });
    }

    const roleId = new ObjectId();
    await db.collection("Role").insertOne({
      _id: roleId,
      tenantId,
      name: "SUPER_ADMIN",
      permissionIds,
      createdAt: now,
      updatedAt: now
    });

    await db.collection("Permission").updateMany(
      { _id: { $in: permissionIds } },
      { $set: { roleIds: [roleId], updatedAt: now } }
    );

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = new ObjectId();
    await db.collection("User").insertOne({
      _id: userId,
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
      userId,
      membershipRole: "OWNER",
      joinedAt: now,
      createdAt: now,
      updatedAt: now
    });

    console.log("Bootstrap complete (no operational sample data).");
    console.log(`tenant: ${tenantSlug} (${tenantId.toHexString()})`);
    console.log(`user: ${email} (${userId.toHexString()})`);
    console.log("role: SUPER_ADMIN");
    console.log(`permissions: ${permissionIds.length}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`BOOTSTRAP FAILED: ${err.message}`);
  process.exit(1);
});