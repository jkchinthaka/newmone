#!/usr/bin/env node
/**
 * Local/dev only: set a new password for one user and clear any login lock.
 *
 *   set RESET_EMAIL=superadmin@maintainpro.local
 *   set RESET_PASSWORD=YourNewPassword123
 *   node scripts/dev/reset-user-password.mjs
 *
 * The password is read from the environment so it never appears in the script or in chat.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(path.join(root, "apps", "api", "package.json"));

// Load root .env (DATABASE_URL) without printing it.
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const email = (process.env.RESET_EMAIL || "").trim().toLowerCase();
const password = process.env.RESET_PASSWORD || "";
if (!email || password.length < 10) {
  console.error("Set RESET_EMAIL and RESET_PASSWORD (min 10 characters) first.");
  process.exit(1);
}
if (/production/i.test(process.env.NODE_ENV || "")) {
  console.error("Refusing to run with NODE_ENV=production.");
  process.exit(1);
}

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

try {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error("No user with that email.");
    process.exit(1);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      failedLoginAttempts: 0,
      lockedUntil: null,
      mustChangePassword: false,
      lastPasswordChangedAt: new Date()
    }
  });
  console.log(`Password reset for ${email}. Login lock cleared.`);
} finally {
  await prisma.$disconnect();
}
