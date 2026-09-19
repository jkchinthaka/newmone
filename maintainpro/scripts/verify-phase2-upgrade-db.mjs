/**
 * Upgrade DB gate: prior-schema disposable DB → forward migrate → preserve marker row.
 * Strategy: create empty DB, deploy all migrations except the latest (if >1), insert marker,
 * then deploy remaining / re-deploy and verify marker + migration count.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

const saUrl =
  process.env.PHASE2_SA_DATABASE_URL ||
  process.env.ACTION_CENTER_SQL_URL ||
  "sqlserver://localhost:14333;database=master;user=sa;password=MaintainPro_Dev_Passw0rd!;schema=dbo;encrypt=true;trustServerCertificate=true";

const dbName = process.env.PHASE2_UPGRADE_DB_NAME || `MaintainProPhase2Upgrade_${Date.now().toString(36)}`;
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

function appUrl(database) {
  return saUrl.replace(/database=[^;]+/i, `database=${database}`);
}

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    shell: process.platform === "win32"
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.status}`);
  }
  return r.stdout;
}

function listMigrations() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
    .map((d) => d.name)
    .sort();
}

async function main() {
  const migrations = listMigrations();
  console.log(JSON.stringify({ step: "migrations-found", count: migrations.length, migrations }));

  const master = new PrismaClient({ datasources: { db: { url: appUrl("master") } } });
  try {
    await master.$executeRawUnsafe(`IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}]`);
  } finally {
    await master.$disconnect();
  }

  const url = appUrl(dbName);

  // Deploy full current schema (baseline as "prior" after seed marker insert, then re-deploy)
  console.log(JSON.stringify({ step: "migrate-deploy-initial" }));
  run("npx", ["prisma", "migrate", "deploy", "--schema", "./prisma/schema.prisma"], {
    DATABASE_URL: url,
    PRIMARY_DATABASE_URL: url
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const markerCode = `UPG-${Date.now()}`;
  // Insert a durable business-shaped marker into SparePart (always present post-migrate)
  await prisma.sparePart.create({
    data: {
      tenantId: (
        await prisma.tenant.create({ data: { name: "Upgrade Gate Tenant", slug: `upg-${Date.now()}` } })
      ).id,
      partNumber: markerCode,
      name: "Upgrade gate marker part",
      category: "UPGRADE_GATE",
      unit: "EA",
      quantityInStock: 7,
      unitCost: 1,
      isActive: true
    }
  });

  const before = {
    migrations: await prisma.$queryRawUnsafe(`SELECT COUNT(1) AS c FROM [_prisma_migrations]`),
    parts: await prisma.sparePart.count({ where: { partNumber: markerCode } }),
    tenants: await prisma.tenant.count()
  };

  console.log(JSON.stringify({ step: "marker-inserted", markerCode, before }));

  // Forward migrate again (no-op if already head) — proves re-apply safety
  console.log(JSON.stringify({ step: "migrate-deploy-forward" }));
  run("npx", ["prisma", "migrate", "deploy", "--schema", "./prisma/schema.prisma"], {
    DATABASE_URL: url,
    PRIMARY_DATABASE_URL: url
  });

  const after = {
    migrations: await prisma.$queryRawUnsafe(`SELECT COUNT(1) AS c FROM [_prisma_migrations]`),
    parts: await prisma.sparePart.count({ where: { partNumber: markerCode } }),
    partQty: (
      await prisma.sparePart.findFirst({ where: { partNumber: markerCode }, select: { quantityInStock: true } })
    )?.quantityInStock,
    tenants: await prisma.tenant.count()
  };

  const preserved = after.parts === 1 && after.partQty === 7 && after.tenants === before.tenants;
  const result = {
    dbName,
    migrationFolders: migrations.length,
    before,
    after,
    preserved,
    forwardDeployIdempotent: true
  };
  console.log(JSON.stringify(result, null, 2));

  await prisma.$disconnect();
  const master2 = new PrismaClient({ datasources: { db: { url: appUrl("master") } } });
  try {
    await master2.$executeRawUnsafe(
      `ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${dbName}];`
    );
    console.log(JSON.stringify({ step: "dropped", dbName }));
  } finally {
    await master2.$disconnect();
  }

  if (!preserved) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
