import { PrismaClient, Priority, RoleName, WorkOrderStatus, WorkOrderType } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const permissionCatalog = [
  "users.manage",
  "roles.manage",
  "modules.view_all",
  "assets.manage",
  "work_orders.manage",
  "work_orders.update_status",
  "work_orders.view_own",
  "fleet.manage",
  "fleet.log_fuel_trip",
  "inventory.manage",
  "reports.view",
  "utilities.manage",
  "system.configure",
  "cleaning.manage",
  "cleaning.log_visit",
  "cleaning.sign_off",
  "cleaning.report_issue"
];

const rolePermissions: Record<RoleName, string[]> = {
  SUPER_ADMIN: [...permissionCatalog],
  ADMIN: permissionCatalog.filter((p) => p !== "system.configure"),
  MANAGER: [
    "modules.view_all",
    "assets.manage",
    "work_orders.manage",
    "work_orders.update_status",
    "work_orders.view_own",
    "fleet.manage",
    "fleet.log_fuel_trip",
    "inventory.manage",
    "reports.view",
    "utilities.manage",
    "cleaning.manage"
  ],
  TECHNICIAN: ["work_orders.update_status", "work_orders.view_own", "inventory.manage"],
  MECHANIC: ["work_orders.update_status", "work_orders.view_own", "inventory.manage"],
  ASSET_MANAGER: [
    "assets.manage",
    "work_orders.manage",
    "work_orders.update_status",
    "reports.view"
  ],
  INVENTORY_KEEPER: ["inventory.manage", "reports.view"],
  SUPERVISOR: [
    "modules.view_all",
    "cleaning.manage",
    "cleaning.sign_off",
    "cleaning.report_issue",
    "reports.view"
  ],
  CLEANER: ["cleaning.log_visit", "cleaning.report_issue"],
  DRIVER: ["fleet.log_fuel_trip"],
  VIEWER: ["modules.view_all", "reports.view"]
};

async function ensurePermissions() {
  for (const key of permissionCatalog) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        description: key
      }
    });
  }
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "MaintainPro Default Tenant",
      slug: "default"
    }
  });

  await ensurePermissions();

  const permissions = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  const roles = new Map<RoleName, { id: string }>();

  for (const roleName of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: roleName
        }
      },
      update: {
        permissions: {
          set: rolePermissions[roleName].map((key) => ({ id: permissionIdByKey.get(key)! }))
        }
      },
      create: {
        tenantId: tenant.id,
        name: roleName,
        permissions: {
          connect: rolePermissions[roleName].map((key) => ({ id: permissionIdByKey.get(key)! }))
        }
      }
    });

    roles.set(roleName, { id: role.id });
  }

  const adminPasswordHash = await bcrypt.hash("Admin@1234", 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@maintainpro.local" },
    update: {
      firstName: "Super",
      lastName: "Admin",
      roleId: roles.get(RoleName.SUPER_ADMIN)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "superadmin@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Super",
      lastName: "Admin",
      roleId: roles.get(RoleName.SUPER_ADMIN)!.id,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@maintainpro.local" },
    update: {
      firstName: "Platform",
      lastName: "Admin",
      roleId: roles.get(RoleName.ADMIN)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "admin@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Platform",
      lastName: "Admin",
      roleId: roles.get(RoleName.ADMIN)!.id,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "supervisor@maintainpro.local" },
    update: {
      firstName: "Cleaning",
      lastName: "Supervisor",
      roleId: roles.get(RoleName.SUPERVISOR)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "supervisor@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Cleaning",
      lastName: "Supervisor",
      roleId: roles.get(RoleName.SUPERVISOR)!.id,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "cleaner@maintainpro.local" },
    update: {
      firstName: "Kamal",
      lastName: "Perera",
      roleId: roles.get(RoleName.CLEANER)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "cleaner@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Kamal",
      lastName: "Perera",
      roleId: roles.get(RoleName.CLEANER)!.id,
      isActive: true
    }
  });

  const driverUsers = [];
  for (let i = 1; i <= 3; i += 1) {
    const driverUser = await prisma.user.upsert({
      where: { email: `driver${i}@maintainpro.local` },
      update: {
        firstName: `Driver${i}`,
        lastName: "Operator",
        roleId: roles.get(RoleName.DRIVER)!.id,
        tenantId: tenant.id,
        passwordHash: adminPasswordHash,
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        email: `driver${i}@maintainpro.local`,
        passwordHash: adminPasswordHash,
        firstName: `Driver${i}`,
        lastName: "Operator",
        roleId: roles.get(RoleName.DRIVER)!.id,
        isActive: true
      }
    });

    driverUsers.push(driverUser);
  }

  const drivers = [];
  for (let i = 0; i < driverUsers.length; i += 1) {
    const driver = await prisma.driver.upsert({
      where: { userId: driverUsers[i].id },
      update: {
        tenantId: tenant.id,
        licenseClass: "Class A",
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      },
      create: {
        tenantId: tenant.id,
        userId: driverUsers[i].id,
        licenseNumber: `LIC-2026-${1000 + i}`,
        licenseClass: "Class A",
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });

    drivers.push(driver);
  }

  const assetTags = ["AST-1001", "AST-1002", "AST-1003", "AST-1004", "AST-1005"];
  const assetIds: string[] = [];

  for (let i = 0; i < assetTags.length; i += 1) {
    const asset = await prisma.asset.upsert({
      where: { assetTag: assetTags[i] },
      update: {
        tenantId: tenant.id,
        name: `Sample Asset ${i + 1}`,
        category: i % 2 === 0 ? "MACHINE" : "EQUIPMENT",
        status: "ACTIVE",
        images: [],
        documents: [],
        location: i % 2 === 0 ? "Plant A" : "Plant B"
      },
      create: {
        tenantId: tenant.id,
        assetTag: assetTags[i],
        name: `Sample Asset ${i + 1}`,
        category: i % 2 === 0 ? "MACHINE" : "EQUIPMENT",
        status: "ACTIVE",
        images: [],
        documents: [],
        location: i % 2 === 0 ? "Plant A" : "Plant B"
      }
    });

    assetIds.push(asset.id);
  }

  const vehicleIds: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const vehicle = await prisma.vehicle.upsert({
      where: { registrationNo: `MH-01-AB-10${i}` },
      update: {
        tenantId: tenant.id,
        make: "Toyota",
        vehicleModel: `Model ${i}`,
        year: 2020 + (i % 4),
        type: i % 2 === 0 ? "VAN" : "TRUCK",
        fuelType: i % 2 === 0 ? "DIESEL" : "PETROL",
        currentMileage: 10000 + i * 1200,
        images: [],
        driverId: i <= drivers.length ? drivers[i - 1].id : undefined
      },
      create: {
        tenantId: tenant.id,
        registrationNo: `MH-01-AB-10${i}`,
        make: "Toyota",
        vehicleModel: `Model ${i}`,
        year: 2020 + (i % 4),
        type: i % 2 === 0 ? "VAN" : "TRUCK",
        fuelType: i % 2 === 0 ? "DIESEL" : "PETROL",
        currentMileage: 10000 + i * 1200,
        images: [],
        driverId: i <= drivers.length ? drivers[i - 1].id : undefined
      }
    });

    vehicleIds.push(vehicle.id);
  }

  for (let i = 1; i <= 10; i += 1) {
    await prisma.sparePart.upsert({
      where: { partNumber: `SP-${2000 + i}` },
      update: {
        tenantId: tenant.id,
        name: `Spare Part ${i}`,
        category: i % 2 === 0 ? "Engine" : "Electrical",
        quantityInStock: 20 - i,
        minimumStock: 5,
        reorderPoint: 3,
        unitCost: 25 + i,
        images: []
      },
      create: {
        tenantId: tenant.id,
        partNumber: `SP-${2000 + i}`,
        name: `Spare Part ${i}`,
        category: i % 2 === 0 ? "Engine" : "Electrical",
        quantityInStock: 20 - i,
        minimumStock: 5,
        reorderPoint: 3,
        unitCost: 25 + i,
        images: []
      }
    });
  }

  const workOrderStatuses: WorkOrderStatus[] = [
    WorkOrderStatus.OPEN,
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.ON_HOLD,
    WorkOrderStatus.COMPLETED,
    WorkOrderStatus.CANCELLED
  ];

  for (let i = 0; i < workOrderStatuses.length; i += 1) {
    const woNumber = `WO-${new Date().getFullYear()}-${String(i + 1).padStart(4, "0")}`;

    await prisma.workOrder.upsert({
      where: { woNumber },
      update: {
        tenantId: tenant.id,
        title: `Sample Work Order ${i + 1}`,
        description: `Generated sample work order ${i + 1}`,
        priority: [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL, Priority.MEDIUM][i],
        status: workOrderStatuses[i],
        type: [WorkOrderType.PREVENTIVE, WorkOrderType.CORRECTIVE, WorkOrderType.EMERGENCY, WorkOrderType.INSPECTION, WorkOrderType.INSTALLATION][i],
        assetId: assetIds[i % assetIds.length],
        vehicleId: vehicleIds[i % vehicleIds.length],
        createdById: superAdmin.id,
        notes: "Seeded work order",
        attachments: []
      },
      create: {
        tenantId: tenant.id,
        woNumber,
        title: `Sample Work Order ${i + 1}`,
        description: `Generated sample work order ${i + 1}`,
        priority: [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL, Priority.MEDIUM][i],
        status: workOrderStatuses[i],
        type: [WorkOrderType.PREVENTIVE, WorkOrderType.CORRECTIVE, WorkOrderType.EMERGENCY, WorkOrderType.INSPECTION, WorkOrderType.INSTALLATION][i],
        assetId: assetIds[i % assetIds.length],
        vehicleId: vehicleIds[i % vehicleIds.length],
        createdById: superAdmin.id,
        notes: "Seeded work order",
        attachments: []
      }
    });
  }

  const meterDefinitions = [
    { meterNumber: "ELEC-1001", type: "ELECTRICITY", location: "HQ Building", unit: "kWh" },
    { meterNumber: "WTR-1001", type: "WATER", location: "HQ Building", unit: "m3" }
  ] as const;

  const meterIds: string[] = [];

  for (const meterDef of meterDefinitions) {
    const meter = await prisma.utilityMeter.upsert({
      where: { meterNumber: meterDef.meterNumber },
      update: {
        tenantId: tenant.id,
        type: meterDef.type,
        location: meterDef.location,
        unit: meterDef.unit
      },
      create: {
        tenantId: tenant.id,
        meterNumber: meterDef.meterNumber,
        type: meterDef.type,
        location: meterDef.location,
        unit: meterDef.unit
      }
    });

    meterIds.push(meter.id);

    let baseReading = meterDef.type === "ELECTRICITY" ? 10000 : 6000;

    for (let i = 0; i < 6; i += 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      baseReading += meterDef.type === "ELECTRICITY" ? 600 : 140;

      await prisma.meterReading.create({
        data: {
          meterId: meter.id,
          readingDate: date,
          readingValue: baseReading,
          consumption: meterDef.type === "ELECTRICITY" ? 600 : 140,
          images: [],
          notes: "Seeded reading"
        }
      });
    }

    for (let i = 0; i < 6; i += 1) {
      const periodStart = new Date();
      periodStart.setMonth(periodStart.getMonth() - (5 - i));
      periodStart.setDate(1);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(0);

      const consumption = meterDef.type === "ELECTRICITY" ? 600 : 140;
      const ratePerUnit = meterDef.type === "ELECTRICITY" ? 0.14 : 0.07;
      const baseCharge = meterDef.type === "ELECTRICITY" ? 20 : 10;
      const taxAmount = 8;
      const totalAmount = consumption * ratePerUnit + baseCharge + taxAmount;

      await prisma.utilityBill.create({
        data: {
          tenantId: tenant.id,
          meterId: meter.id,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          totalConsumption: consumption,
          ratePerUnit,
          baseCharge,
          taxAmount,
          totalAmount,
          dueDate: new Date(periodEnd.getTime() + 10 * 24 * 60 * 60 * 1000),
          status: i < 4 ? "PAID" : "UNPAID"
        }
      });
    }
  }

  const cleaningLocations = [
    {
      qrCode: "06b558d1-3352-4924-ae6c-f8df06cdf7cf",
      name: "Ground Floor - Male Toilet",
      area: "Lobby Wing",
      building: "Main Building",
      floor: "Ground",
      description: "Primary public restroom near reception"
    },
    {
      qrCode: "e55f9ed2-90d4-4c17-ac4b-cf8599fc6faa",
      name: "First Floor - Female Toilet",
      area: "Admin Wing",
      building: "Main Building",
      floor: "First",
      description: "Executive office washroom"
    },
    {
      qrCode: "5f2032a1-7c6f-43f1-a9c9-bec5ef0e6287",
      name: "Warehouse - Staff Washroom",
      area: "Warehouse",
      building: "Operations Block",
      floor: "Ground",
      description: "Staff washroom beside the loading bay"
    }
  ];

  for (const location of cleaningLocations) {
    const scanUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3001"}/cleaning/scan?code=${location.qrCode}`;

    await prisma.cleaningLocation.upsert({
      where: { qrCode: location.qrCode },
      update: {
        tenantId: tenant.id,
        name: location.name,
        area: location.area,
        building: location.building,
        floor: location.floor,
        description: location.description,
        qrCodeUrl: scanUrl,
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        name: location.name,
        area: location.area,
        building: location.building,
        floor: location.floor,
        description: location.description,
        qrCode: location.qrCode,
        qrCodeUrl: scanUrl,
        isActive: true
      }
    });
  }

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
