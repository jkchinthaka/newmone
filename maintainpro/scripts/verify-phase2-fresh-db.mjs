/**
 * Fresh empty SQL Server DB gate (disposable).
 * Creates MaintainProPhase2Empty*, migrate deploy, seed x2, verify no duplicate roles/users.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

const saUrl =
  process.env.PHASE2_SA_DATABASE_URL ||
  process.env.ACTION_CENTER_SQL_URL ||
  "sqlserver://localhost:14333;database=master;user=sa;password=MaintainPro_Dev_Passw0rd!;schema=dbo;encrypt=true;trustServerCertificate=true";

const dbName = process.env.PHASE2_FRESH_DB_NAME || `MaintainProPhase2Empty_${Date.now().toString(36)}`;

function appUrl(database) {
  return saUrl.replace(/database=[^;]+/i, `database=${database}`);
}

async function execSql(database, sql) {
  const prisma = new PrismaClient({ datasources: { db: { url: appUrl(database) } } });
  try {
    await prisma.$executeRawUnsafe(sql);
  } finally {
    await prisma.$disconnect();
  }
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

async function main() {
  console.log(JSON.stringify({ step: "create-db", dbName }));
  const master = new PrismaClient({ datasources: { db: { url: appUrl("master") } } });
  try {
    await master.$executeRawUnsafe(
      `IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}]`
    );
  } finally {
    await master.$disconnect();
  }

  const url = appUrl(dbName);
  console.log(JSON.stringify({ step: "migrate-deploy" }));
  run("npx", ["prisma", "migrate", "deploy", "--schema", "./prisma/schema.prisma"], {
    DATABASE_URL: url,
    PRIMARY_DATABASE_URL: url
  });

  console.log(JSON.stringify({ step: "seed-1" }));
  run("npm", ["run", "db:seed"], {
    DATABASE_URL: url,
    PRIMARY_DATABASE_URL: url,
    MAINTAINPRO_SEED_PASSWORD: process.env.MAINTAINPRO_SEED_PASSWORD
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const after1 = {
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    tenants: await prisma.tenant.count(),
    parts: await prisma.sparePart.count()
  };

  console.log(JSON.stringify({ step: "seed-2" }));
  run("npm", ["run", "db:seed"], {
    DATABASE_URL: url,
    PRIMARY_DATABASE_URL: url,
    MAINTAINPRO_SEED_PASSWORD: process.env.MAINTAINPRO_SEED_PASSWORD
  });

  const after2 = {
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    tenants: await prisma.tenant.count(),
    parts: await prisma.sparePart.count()
  };

  const roleNames = await prisma.role.groupBy({
    by: ["name", "tenantId"],
    _count: { _all: true }
  });
  const dupRoles = roleNames.filter((r) => r._count._all > 1);

  const result = {
    dbName,
    migrationsApplied: true,
    after1,
    after2,
    seedIdempotent: JSON.stringify(after1) === JSON.stringify(after2),
    duplicateRoleNames: dupRoles.length,
    dupRoles
  };
  console.log(JSON.stringify(result, null, 2));

  // drop disposable DB
  await prisma.$disconnect();
  const master2 = new PrismaClient({ datasources: { db: { url: appUrl("master") } } });
  try {
    await master2.$executeRawUnsafe(
      `ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${dbName}];`
    );
    console.log(JSON.stringify({ step: "dropped", dbName }));
  } catch (e) {
    console.log(JSON.stringify({ step: "drop-failed", message: String(e.message || e) }));
  } finally {
    await master2.$disconnect();
  }

  if (!result.seedIdempotent || result.duplicateRoleNames > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
