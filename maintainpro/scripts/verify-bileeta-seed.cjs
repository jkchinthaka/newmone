require("dotenv").config({ path: "apps/api/.env" });
const { PrismaClient } = require("@prisma/client");

(async () => {
  const p = new PrismaClient();
  try {
    const tenants = await p.tenant.count();
    const users = await p.user.count();
    const perms = await p.permission.count();
    const roles = await p.role.findMany({
      select: {
        name: true,
        _count: { select: { permissions: true, users: true } },
      },
    });
    const veh = await p.vehicle.count();
    const dept = await p.department.count();
    const settings = await p.appSetting.count();
    const notifs = await p.notification.count();
    const wo = await p.workOrder.count();
    const po = await p.purchaseOrder.count();

    console.log("Counts:");
    console.log("  tenants=" + tenants + " users=" + users + " permissions=" + perms);
    console.log("  vehicles=" + veh + " departments=" + dept);
    console.log("  appSettings=" + settings + " notifications=" + notifs + " workOrders=" + wo + " purchaseOrders=" + po);

    console.log("\nRoles (" + roles.length + "):");
    for (const r of roles) {
      console.log("  - " + r.name + " perms=" + r._count.permissions + " users=" + r._count.users);
    }

    const sa = await p.role.findFirst({
      where: { name: "SUPER_ADMIN" },
      include: {
        users: { select: { email: true } },
        permissions: { select: { key: true } },
      },
    });
    if (sa) {
      console.log("\nSUPER_ADMIN role: perms=" + sa.permissions.length + " users=" + sa.users.length);
      sa.users.forEach((u) => console.log("  user: " + u.email));
      if (sa.permissions.length) {
        console.log("  sample perms: " + sa.permissions.slice(0, 5).map((x) => x.key).join(", ") + (sa.permissions.length > 5 ? ", ..." : ""));
      }
    } else {
      console.log("\nSUPER_ADMIN role NOT FOUND");
    }

    const so = await p.user.findFirst({
      where: { email: "security@maintainpro.local" },
      include: {
        role: {
          include: { permissions: { select: { key: true } } },
        },
      },
    });
    if (so) {
      const ps = (so.role && so.role.permissions ? so.role.permissions.map((x) => x.key) : []).sort();
      console.log("\nSECURITY user: " + so.email);
      console.log("  role=" + (so.role && so.role.name));
      console.log("  permissions (" + ps.length + "):");
      ps.forEach((c) => console.log("    - " + c));
      const need = ["gate.out.create", "gate.in.create", "operations.scan_lookup"];
      const missing = need.filter((n) => !ps.includes(n));
      console.log("  required gate perms present: " + (missing.length === 0) + (missing.length ? " missing=" + missing.join(",") : ""));
    } else {
      console.log("\nSECURITY user NOT FOUND");
    }
  } catch (e) {
    console.error("ERR:", e.message);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
