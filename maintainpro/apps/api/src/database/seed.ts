import {
  AppSettingScope,
  BillingInterval,
  DriverTrainingStatus,
  EntitlementType,
  Prisma,
  PrismaClient,
  Priority,
  RoleName,
  SubscriptionStatus,
  TenantMembershipRole,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

import { buildCanonicalDepartmentSeed, createDepartmentCode, normalizeDepartmentName } from "../modules/departments/department-master-list";
import {
  BUILDING_SUPERVISOR_PERMISSIONS,
  FACILITY_MANAGER_PERMISSIONS,
  FACILITY_PERMISSION_KEYS
} from "./facility-seed.constants";

const prisma = new PrismaClient();

function getSeedPassword(): string {
  const password = (process.env.MAINTAINPRO_SEED_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "").trim();
  if (password.length < 12) {
    throw new Error("Set MAINTAINPRO_SEED_PASSWORD to a strong password before running the seed.");
  }

  return password;
}

const permissionCatalog = [
  // Phase 1 enterprise RBAC / PBAC keys
  "dashboard.view",
  "users.view",
  "users.create",
  "users.edit",
  "users.status.manage",
  "users.delete",
  "roles.view",
  "roles.manage",
  "permissions.view",
  "permissions.create",
  "settings.view",
  "settings.organization.manage",
  "settings.system.manage",
  "audit.view",
  "vehicles.view",
  "vehicles.create",
  "vehicles.edit",
  "vehicles.operate",
  "gate.out.create",
  "gate.in.create",
  "vehicles.delete",
  "gate.override.approve",
  "service.rules.manage",
  "settings.manage",

  // Backward-compatible / module-level keys already used by other modules
  "users.manage",
  "modules.view_all",
  "assets.manage",
  "work_orders.manage",
  "work_orders.update_status",
  "work_orders.view_own",
  "part_requests.create",
  "part_requests.view",
  "part_requests.approve_operational",
  "part_requests.approve_finance",
  "part_requests.reject",
  "part_requests.issue",
  "fleet.manage",
  "fleet.log_fuel_trip",
  "inventory.manage",
  "inventory.stock_issue",
  "purchase_orders.approve_operational",
  "purchase_orders.approve_finance",
  "purchase_orders.reject",
  "purchase_orders.erp_sync",
  "purchase_orders.erp_sync_retry",
  "reports.view",
  "utilities.manage",
  "system.configure",
  "cleaning.manage",
  "cleaning.log_visit",
  "cleaning.sign_off",
  "cleaning.report_issue",

  // Building / Facility module — BUILD-002 foundation
  ...FACILITY_PERMISSION_KEYS,

  // Phase 4 — vehicle compliance, documents, accidents, claims, fines
  "compliance.view",
  "vehicle_documents.view",
  "vehicle_documents.manage",
  "vehicle_documents.verify",
  "accidents.view",
  "accidents.report",
  "accidents.manage",
  "insurance_claims.view",
  "insurance_claims.manage",
  "insurance_claims.approve",
  "traffic_fines.view",
  "traffic_fines.report",
  "traffic_fines.manage",
  "traffic_fines.payment",

  // Phase 5 — intelligence, analytics, dashboards
  "driver_intelligence.view",
  "driver_intelligence.manage",
  "dashboard_analytics.view",
  "fuel_analytics.view",
  "vehicle_cost_analytics.view",

  // Phase 6 — operational scanning
  "operations.scan_lookup",
  "predictive_insights.view"
];

const rolePermissions: Record<RoleName, string[]> = {
  SUPER_ADMIN: [...permissionCatalog],
  ADMIN: permissionCatalog.filter((permission) => permission !== "system.configure"),
  OPERATIONS_MANAGER: [
    "dashboard.view",
    "modules.view_all",
    "reports.view",
    "users.view",
    "work_orders.manage",
    "work_orders.update_status",
    "part_requests.view",
    "part_requests.approve_operational",
    "part_requests.approve_finance",
    "part_requests.reject",
    "part_requests.issue",
    "vehicles.view",
    "vehicles.operate",
    "gate.out.create",
    "gate.in.create",
    "inventory.stock_issue",
    "purchase_orders.approve_operational",
    "purchase_orders.approve_finance",
    "purchase_orders.reject",
    "purchase_orders.erp_sync",
    "purchase_orders.erp_sync_retry",
    "gate.override.approve",
    "settings.view",
    "audit.view",
    "dashboard_analytics.view",
    "compliance.view",
    "vehicle_documents.view",
    "accidents.view",
    "insurance_claims.view",
    "traffic_fines.view",
    "driver_intelligence.view",
    "fuel_analytics.view",
    "vehicle_cost_analytics.view",
    "operations.scan_lookup",
    "predictive_insights.view"
  ],
  FLEET_MANAGER: [
    "dashboard.view",
    "dashboard_analytics.view",
    "modules.view_all",
    "reports.view",
    "fleet.manage",
    "fleet.log_fuel_trip",
    "vehicles.view",
    "vehicles.create",
    "vehicles.edit",
    "vehicles.operate",
    "gate.out.create",
    "gate.in.create",
    "gate.override.approve",
    "service.rules.manage",
    "settings.view",
    "audit.view",
    "compliance.view",
    "vehicle_documents.view",
    "vehicle_documents.manage",
    "vehicle_documents.verify",
    "accidents.view",
    "accidents.report",
    "accidents.manage",
    "insurance_claims.view",
    "insurance_claims.manage",
    "insurance_claims.approve",
    "traffic_fines.view",
    "traffic_fines.report",
    "traffic_fines.manage",
    "traffic_fines.payment",
    "driver_intelligence.view",
    "driver_intelligence.manage",
    "fuel_analytics.view",
    "vehicle_cost_analytics.view",
    "operations.scan_lookup",
    "predictive_insights.view"
  ],
  COMPLIANCE_MANAGER: [
    "dashboard.view",
    "dashboard_analytics.view",
    "modules.view_all",
    "reports.view",
    "audit.view",
    "settings.view",
    "users.view",
    "vehicles.view",
    "compliance.view",
    "vehicle_documents.view",
    "vehicle_documents.manage",
    "vehicle_documents.verify",
    "accidents.view",
    "accidents.report",
    "accidents.manage",
    "insurance_claims.view",
    "insurance_claims.manage",
    "insurance_claims.approve",
    "traffic_fines.view",
    "traffic_fines.report",
    "traffic_fines.manage",
    "traffic_fines.payment",
    "driver_intelligence.view",
    "operations.scan_lookup",
    "predictive_insights.view"
  ],
  MANAGER: [
    "dashboard.view",
    "dashboard_analytics.view",
    "modules.view_all",
    "assets.manage",
    "work_orders.manage",
    "work_orders.update_status",
    "work_orders.view_own",
    "part_requests.create",
    "part_requests.view",
    "part_requests.approve_operational",
    "part_requests.approve_finance",
    "part_requests.reject",
    "part_requests.issue",
    "fleet.manage",
    "fleet.log_fuel_trip",
    "inventory.manage",
    "inventory.stock_issue",
    "purchase_orders.approve_operational",
    "purchase_orders.approve_finance",
    "purchase_orders.reject",
    "purchase_orders.erp_sync",
    "purchase_orders.erp_sync_retry",
    "reports.view",
    "utilities.manage",
    "cleaning.manage",
    "users.view",
    "vehicles.view",
    "vehicles.operate",
    "gate.out.create",
    "gate.in.create",
    "gate.override.approve",
    "service.rules.manage",
    "settings.view",
    "compliance.view",
    "vehicle_documents.view",
    "vehicle_documents.manage",
    "vehicle_documents.verify",
    "accidents.view",
    "accidents.report",
    "accidents.manage",
    "insurance_claims.view",
    "insurance_claims.manage",
    "traffic_fines.view",
    "traffic_fines.report",
    "traffic_fines.manage",
    "traffic_fines.payment",
    "driver_intelligence.view",
    "driver_intelligence.manage",
    "fuel_analytics.view",
    "vehicle_cost_analytics.view",
    "operations.scan_lookup",
    "predictive_insights.view",
    "facilities.view",
    "facility_issues.view",
    "facility_issues.manage"
  ],
  TECHNICIAN: [
    "dashboard.view",
    "work_orders.update_status",
    "work_orders.view_own",
    "part_requests.create",
    "part_requests.view",
    "inventory.manage",
    "vehicles.view",
    "operations.scan_lookup",
    "predictive_insights.view"
  ],
  MECHANIC: [
    "dashboard.view",
    "work_orders.update_status",
    "work_orders.view_own",
    "part_requests.create",
    "part_requests.view",
    "inventory.manage",
    "vehicles.view",
    "vehicles.edit",
    "operations.scan_lookup",
    "predictive_insights.view"
  ],
  ASSET_MANAGER: [
    "dashboard.view",
    "dashboard_analytics.view",
    "assets.manage",
    "work_orders.manage",
    "work_orders.update_status",
    "part_requests.create",
    "part_requests.view",
    "part_requests.approve_operational",
    "part_requests.reject",
    "reports.view",
    "purchase_orders.approve_operational",
    "purchase_orders.reject",
    "vehicles.view",
    "vehicles.create",
    "vehicles.edit",
    "vehicles.operate",
    "gate.out.create",
    "gate.in.create",
    "audit.view",
    "driver_intelligence.view",
    "fuel_analytics.view",
    "vehicle_cost_analytics.view",
    "operations.scan_lookup",
    "predictive_insights.view"
  ],
  INVENTORY_KEEPER: [
    "dashboard.view",
    "inventory.manage",
    "inventory.stock_issue",
    "part_requests.view",
    "part_requests.approve_operational",
    "part_requests.issue",
    "purchase_orders.approve_operational",
    "purchase_orders.erp_sync",
    "purchase_orders.erp_sync_retry",
    "reports.view",
    "modules.view_all"
  ],
  SUPERVISOR: [
    "dashboard.view",
    "dashboard_analytics.view",
    "modules.view_all",
    "cleaning.manage",
    "cleaning.sign_off",
    "cleaning.report_issue",
    "part_requests.view",
    "reports.view",
    "users.view",
    "vehicles.view",
    "audit.view",
    "driver_intelligence.view",
    "driver_intelligence.manage",
    "operations.scan_lookup",
    "predictive_insights.view",
    "facilities.view",
    "facility_issues.view",
    "facility_issues.manage",
    "facility_inspections.view"
  ],
  SECURITY_OFFICER: [
    "dashboard.view",
    "vehicles.view",
    "gate.out.create",
    "gate.in.create",
    "operations.scan_lookup",
    "predictive_insights.view"
  ],
  CLEANER: ["cleaning.log_visit", "cleaning.report_issue", "facility_issues.report"],
  DRIVER: [
    "dashboard.view",
    "fleet.log_fuel_trip",
    "vehicles.view",
    "vehicles.operate",
    "gate.out.create",
    "gate.in.create",
    "work_orders.view_own",
    "vehicle_documents.view",
    "accidents.report",
    "accidents.view",
    "traffic_fines.report",
    "traffic_fines.view",
    "driver_intelligence.view",
    "fuel_analytics.view",
    "operations.scan_lookup",
    "predictive_insights.view"
  ],
  VIEWER: [
    "dashboard.view",
    "dashboard_analytics.view",
    "modules.view_all",
    "reports.view",
    "vehicles.view",
    "part_requests.view",
    "settings.view",
    "driver_intelligence.view",
    "fuel_analytics.view",
    "vehicle_cost_analytics.view",
    "facilities.view",
    "facility_issues.view",
    "facility_inspections.view"
  ],
  FACILITY_MANAGER: [...FACILITY_MANAGER_PERMISSIONS],
  BUILDING_SUPERVISOR: [...BUILDING_SUPERVISOR_PERMISSIONS],
  FARM_OWNER: [...permissionCatalog],
  FARM_MANAGER: [
    "dashboard.view",
    "modules.view_all",
    "assets.manage",
    "work_orders.manage",
    "reports.view",
    "settings.view",
    "vehicles.view"
  ],
  FIELD_SUPERVISOR: ["dashboard.view", "modules.view_all", "work_orders.manage", "reports.view", "vehicles.view"],
  AGRONOMIST: ["dashboard.view", "modules.view_all", "reports.view"],
  VETERINARIAN: ["dashboard.view", "modules.view_all", "reports.view"],
  FARM_WORKER: ["work_orders.update_status", "work_orders.view_own"],
  IRRIGATION_OPERATOR: ["work_orders.update_status"],
  HARVEST_CREW: ["work_orders.update_status"]
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

async function ensureMasterDepartments(tenantId: string) {
  const departments = await prisma.department.findMany({
    where: { tenantId },
    select: { id: true, name: true, code: true }
  });
  const byName = new Map(departments.map((department) => [normalizeDepartmentName(department.name), department]));
  const usedCodes = new Set(departments.map((department) => department.code.toUpperCase()));

  for (const department of buildCanonicalDepartmentSeed()) {
    const existing = byName.get(normalizeDepartmentName(department.name));
    if (existing) {
      await prisma.department.update({
        where: { id: existing.id },
        data: {
          name: department.name,
          code: existing.code || department.code,
          isActive: true
        }
      });
      continue;
    }

    const code = createDepartmentCode(department.name, usedCodes);
    usedCodes.add(code);

    await prisma.department.create({
      data: {
        tenantId,
        name: department.name,
        code,
        isActive: true
      }
    });
  }
}

async function ensureSystemPolicyDefaults(tenantId: string) {
  const defaults: Array<{ key: string; value: Record<string, unknown>; isSecret?: boolean }> = [
    {
      key: "organization.profile",
      value: {
        timezone: "UTC",
        currency: "USD",
        logoUrl: ""
      }
    },
    {
      key: "system.configuration",
      value: {
        slaThresholdHours: {
          critical: 4,
          high: 24,
          medium: 72,
          low: 168
        },
        utilityRates: {
          electricity: 0,
          water: 0,
          gas: 0
        },
        notificationRules: {
          onlyCritical: false,
          emailOnlyOverdue: false
        },
        vehicleGatePolicy: {
          blockWhenServiceOverdue: true,
          allowManagerOverride: true,
          dueSoonMileageThreshold: 500,
          dueSoonDaysThreshold: 14
        }
      }
    },
    {
      key: "system.featureToggles",
      value: {
        aiAssistant: true,
        predictiveAlerts: true,
        fleetModule: true,
        cleaningModule: true,
        utilitiesModule: true,
        inventoryModule: true
      }
    },
    {
      key: "system.accessPolicy",
      value: {
        requireMfaForAdmin: false,
        sessionTimeoutMinutes: 480,
        minimumPasswordLength: 8,
        maxFailedLoginAttempts: 5
      }
    },
    {
      key: "system.auditPolicy",
      value: {
        retentionDays: 365,
        includeActorSnapshot: true,
        includeRequestMetadata: true
      }
    }
  ];

  for (const item of defaults) {
    await prisma.appSetting.upsert({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.TENANT,
          scopeId: tenantId,
          key: item.key
        }
      },
      create: {
        scope: AppSettingScope.TENANT,
        scopeId: tenantId,
        key: item.key,
        value: item.value as Prisma.InputJsonValue,
        isSecret: item.isSecret ?? false
      },
      update: {
        value: item.value as Prisma.InputJsonValue,
        isSecret: item.isSecret ?? false
      }
    });
  }
}

async function ensureVehicleGatePolicyBackfill() {
  const settings = await prisma.appSetting.findMany({
    where: {
      scope: AppSettingScope.TENANT,
      key: "system.configuration"
    },
    select: {
      id: true,
      value: true
    }
  });

  for (const setting of settings) {
    const currentValue =
      setting.value && typeof setting.value === "object" && !Array.isArray(setting.value)
        ? ({ ...setting.value } as Record<string, unknown>)
        : {};

    if (currentValue.vehicleGatePolicy && typeof currentValue.vehicleGatePolicy === "object") {
      continue;
    }

    currentValue.vehicleGatePolicy = {
      blockWhenServiceOverdue: true,
      allowManagerOverride: true,
      dueSoonMileageThreshold: 500,
      dueSoonDaysThreshold: 14
    };

    await prisma.appSetting.update({
      where: { id: setting.id },
      data: {
        value: currentValue as Prisma.InputJsonValue
      }
    });
  }
}

async function verifySeedBaseline(tenantId: string) {
  const requiredRoles: RoleName[] = [
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.MANAGER,
    RoleName.SECURITY_OFFICER,
    RoleName.DRIVER,
    RoleName.TECHNICIAN,
    RoleName.FACILITY_MANAGER,
    RoleName.BUILDING_SUPERVISOR
  ];

  const [roles, permissions, systemConfiguration, usersCount, tenantsCount] = await Promise.all([
    prisma.role.findMany({ where: { tenantId, name: { in: requiredRoles } }, include: { permissions: true } }),
    prisma.permission.findMany({ where: { key: { in: permissionCatalog } } }),
    prisma.appSetting.findUnique({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.TENANT,
          scopeId: tenantId,
          key: "system.configuration"
        }
      }
    }),
    prisma.user.count({ where: { tenantId } }),
    prisma.tenant.count()
  ]);

  const roleNames = new Set(roles.map((role) => role.name));
  const missingRoles = requiredRoles.filter((roleName) => !roleNames.has(roleName));
  if (missingRoles.length > 0) {
    throw new Error(`Seed verification failed: missing roles ${missingRoles.join(", ")}`);
  }

  const permissionKeys = new Set(permissions.map((permission) => permission.key));
  const missingPermissions = permissionCatalog.filter((permission) => !permissionKeys.has(permission));
  if (missingPermissions.length > 0) {
    throw new Error(`Seed verification failed: missing permissions ${missingPermissions.join(", ")}`);
  }

  const superAdmin = roles.find((role) => role.name === RoleName.SUPER_ADMIN);
  const superAdminPermissions = new Set(superAdmin?.permissions.map((permission) => permission.key) ?? []);
  const missingSuperAdminPermissions = permissionCatalog.filter(
    (permission) => !superAdminPermissions.has(permission)
  );
  if (missingSuperAdminPermissions.length > 0) {
    throw new Error(
      `Seed verification failed: SUPER_ADMIN missing ${missingSuperAdminPermissions.join(", ")}`
    );
  }

  const configurationValue =
    systemConfiguration?.value && typeof systemConfiguration.value === "object" && !Array.isArray(systemConfiguration.value)
      ? (systemConfiguration.value as Record<string, unknown>)
      : null;
  if (!configurationValue?.vehicleGatePolicy) {
    throw new Error("Seed verification failed: vehicle gate policy is missing");
  }

  if (usersCount < 1 || tenantsCount < 1) {
    throw new Error("Seed verification failed: core MongoDB collections are not queryable");
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
  await ensureMasterDepartments(tenant.id);
  await ensureSystemPolicyDefaults(tenant.id);
  await ensureVehicleGatePolicyBackfill();

  const permissions = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  const roles = new Map<RoleName, { id: string }>();

  for (const roleName of Object.values(RoleName)) {
    const permissionIds = rolePermissions[roleName].map((key) => permissionIdByKey.get(key)!).filter(Boolean);
    const existing = await prisma.role.findFirst({
      where: { tenantId: tenant.id, name: roleName }
    });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { permissionIds: { set: permissionIds } }
        })
      : await prisma.role.create({
          data: {
            tenantId: tenant.id,
            name: roleName,
            permissionIds: { set: permissionIds }
          }
        });

    roles.set(roleName, { id: role.id });
  }

  const adminPasswordHash = await bcrypt.hash(getSeedPassword(), 12);

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
      designation: "SUPERVISOR",
      dailyCapacityHours: 8,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "supervisor@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Cleaning",
      lastName: "Supervisor",
      roleId: roles.get(RoleName.SUPERVISOR)!.id,
      designation: "SUPERVISOR",
      dailyCapacityHours: 8,
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
      designation: "CLEANER",
      dailyCapacityHours: 8,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "cleaner@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Kamal",
      lastName: "Perera",
      roleId: roles.get(RoleName.CLEANER)!.id,
      designation: "CLEANER",
      dailyCapacityHours: 8,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "security@maintainpro.local" },
    update: {
      firstName: "Security",
      lastName: "Officer",
      roleId: roles.get(RoleName.SECURITY_OFFICER)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "security@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Security",
      lastName: "Officer",
      roleId: roles.get(RoleName.SECURITY_OFFICER)!.id,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "manager@maintainpro.local" },
    update: {
      firstName: "Operations",
      lastName: "Manager",
      roleId: roles.get(RoleName.MANAGER)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "manager@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Operations",
      lastName: "Manager",
      roleId: roles.get(RoleName.MANAGER)!.id,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "tech@maintainpro.local" },
    update: {
      firstName: "Field",
      lastName: "Technician",
      roleId: roles.get(RoleName.TECHNICIAN)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      designation: "TECHNICIAN",
      dailyCapacityHours: 8,
      skills: ["General maintenance", "Preventive service"],
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "tech@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Field",
      lastName: "Technician",
      roleId: roles.get(RoleName.TECHNICIAN)!.id,
      designation: "TECHNICIAN",
      dailyCapacityHours: 8,
      skills: ["General maintenance", "Preventive service"],
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "mechanic@maintainpro.local" },
    update: {
      firstName: "Workshop",
      lastName: "Mechanic",
      roleId: roles.get(RoleName.MECHANIC)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      designation: "MECHANIC",
      dailyCapacityHours: 8,
      skills: ["Engine repair", "Hydraulics"],
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "mechanic@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Workshop",
      lastName: "Mechanic",
      roleId: roles.get(RoleName.MECHANIC)!.id,
      designation: "MECHANIC",
      dailyCapacityHours: 8,
      skills: ["Engine repair", "Hydraulics"],
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "inventory@maintainpro.local" },
    update: {
      firstName: "Store",
      lastName: "Keeper",
      roleId: roles.get(RoleName.INVENTORY_KEEPER)!.id,
      tenantId: tenant.id,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "inventory@maintainpro.local",
      passwordHash: adminPasswordHash,
      firstName: "Store",
      lastName: "Keeper",
      roleId: roles.get(RoleName.INVENTORY_KEEPER)!.id,
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
    const trainingStatus =
      i === 0
        ? DriverTrainingStatus.CURRENT
        : i === 1
          ? DriverTrainingStatus.CURRENT
          : DriverTrainingStatus.IN_PROGRESS;
    const trainingCompletedAt =
      i === 2 ? null : new Date(Date.now() - (90 + i * 15) * 24 * 60 * 60 * 1000);
    const trainingExpiry =
      i === 2 ? null : new Date(Date.now() + (180 - i * 30) * 24 * 60 * 60 * 1000);

    const driver = await prisma.driver.upsert({
      where: { userId: driverUsers[i].id },
      update: {
        tenantId: tenant.id,
        licenseClass: "Class A",
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        trainingStatus,
        trainingCompletedAt,
        trainingExpiry,
        supervisorReviewScore: 92 - i * 11,
        pendingDisciplinaryIssues: i === 0 ? 0 : i === 1 ? 1 : 2
      },
      create: {
        tenantId: tenant.id,
        userId: driverUsers[i].id,
        licenseNumber: `LIC-2026-${1000 + i}`,
        licenseClass: "Class A",
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        trainingStatus,
        trainingCompletedAt,
        trainingExpiry,
        supervisorReviewScore: 92 - i * 11,
        pendingDisciplinaryIssues: i === 0 ? 0 : i === 1 ? 1 : 2
      }
    });

    drivers.push(driver);
  }

  const planDefinitions: Array<{
    code: string;
    name: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    entitlements: Array<{
      key: string;
      type: EntitlementType;
      enabled: boolean;
      limitValue?: number;
      unit?: string;
    }>;
  }> = [
    {
      code: "STARTER",
      name: "Starter",
      description: "Starter plan for smaller teams",
      priceMonthly: 29,
      priceYearly: 290,
      entitlements: [
        { key: "users.max", type: EntitlementType.LIMIT, enabled: true, limitValue: 10, unit: "users" },
        { key: "assets.max", type: EntitlementType.LIMIT, enabled: true, limitValue: 250, unit: "assets" },
        { key: "work_orders.monthly", type: EntitlementType.LIMIT, enabled: true, limitValue: 1200, unit: "work_orders" },
        { key: "feature.analytics.advanced", type: EntitlementType.FEATURE, enabled: false },
        { key: "feature.ai.copilot", type: EntitlementType.FEATURE, enabled: false }
      ]
    },
    {
      code: "GROWTH",
      name: "Growth",
      description: "Growth plan for scaling operations",
      priceMonthly: 99,
      priceYearly: 990,
      entitlements: [
        { key: "users.max", type: EntitlementType.LIMIT, enabled: true, limitValue: 50, unit: "users" },
        { key: "assets.max", type: EntitlementType.LIMIT, enabled: true, limitValue: 2000, unit: "assets" },
        { key: "work_orders.monthly", type: EntitlementType.LIMIT, enabled: true, limitValue: 10000, unit: "work_orders" },
        { key: "feature.analytics.advanced", type: EntitlementType.FEATURE, enabled: true },
        { key: "feature.ai.copilot", type: EntitlementType.FEATURE, enabled: true }
      ]
    },
    {
      code: "ENTERPRISE",
      name: "Enterprise",
      description: "Enterprise plan with unlimited scale",
      priceMonthly: 299,
      priceYearly: 2990,
      entitlements: [
        { key: "users.max", type: EntitlementType.LIMIT, enabled: true, limitValue: 1000, unit: "users" },
        { key: "assets.max", type: EntitlementType.LIMIT, enabled: true, limitValue: 100000, unit: "assets" },
        { key: "work_orders.monthly", type: EntitlementType.LIMIT, enabled: true, limitValue: 500000, unit: "work_orders" },
        { key: "feature.analytics.advanced", type: EntitlementType.FEATURE, enabled: true },
        { key: "feature.ai.copilot", type: EntitlementType.FEATURE, enabled: true }
      ]
    }
  ];

  const plansByCode = new Map<string, { id: string }>();

  for (const definition of planDefinitions) {
    const plan = await prisma.plan.upsert({
      where: { code: definition.code },
      update: {
        name: definition.name,
        description: definition.description,
        currency: "USD",
        isActive: true,
        priceMonthly: definition.priceMonthly,
        priceYearly: definition.priceYearly
      },
      create: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        currency: "USD",
        isActive: true,
        priceMonthly: definition.priceMonthly,
        priceYearly: definition.priceYearly
      }
    });

    plansByCode.set(definition.code, { id: plan.id });

    for (const entitlement of definition.entitlements) {
      await prisma.entitlement.upsert({
        where: {
          planId_key: {
            planId: plan.id,
            key: entitlement.key
          }
        },
        update: {
          type: entitlement.type,
          enabled: entitlement.enabled,
          limitValue: entitlement.limitValue,
          unit: entitlement.unit
        },
        create: {
          planId: plan.id,
          key: entitlement.key,
          type: entitlement.type,
          enabled: entitlement.enabled,
          limitValue: entitlement.limitValue,
          unit: entitlement.unit
        }
      });
    }
  }

  const currentSubscription = await prisma.subscription.findFirst({
    where: {
      tenantId: tenant.id,
      isCurrent: true
    },
    orderBy: { createdAt: "desc" }
  });

  const growthPlan = plansByCode.get("GROWTH");

  if (growthPlan) {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);

    if (currentSubscription) {
      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: growthPlan.id,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: BillingInterval.MONTHLY,
          seats: 50,
          isCurrent: true,
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: nextMonth,
          cancelAtPeriodEnd: false,
          canceledAt: null
        }
      });
    } else {
      await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: growthPlan.id,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: BillingInterval.MONTHLY,
          seats: 50,
          isCurrent: true,
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: nextMonth
        }
      });
    }
  }

  const tenantUsers = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      role: {
        select: {
          name: true
        }
      }
    }
  });

  for (const tenantUser of tenantUsers) {
    const membershipRole =
      tenantUser.role.name === RoleName.SUPER_ADMIN
        ? TenantMembershipRole.OWNER
        : tenantUser.role.name === RoleName.ADMIN || tenantUser.role.name === RoleName.MANAGER
          ? TenantMembershipRole.ADMIN
          : TenantMembershipRole.MEMBER;

    await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: tenantUser.id
        }
      },
      update: {
        membershipRole
      },
      create: {
        tenantId: tenant.id,
        userId: tenantUser.id,
        membershipRole
      }
    });
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
    const vin = `VINSEED${i.toString().padStart(10, "0")}`;
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
        vin,
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
        vin,
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

  await verifySeedBaseline(tenant.id);

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
