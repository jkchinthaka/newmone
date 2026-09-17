import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PrismaService } from "../../database/prisma.service";
import { rolePermissionKeys } from "../utils/role-permissions.util";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

type RequestUser = {
  sub?: string;
  role?: string;
  permissions?: string[];
};

const COMPATIBLE_PERMISSION_ALIASES: Record<string, string[]> = {
  "gate.out.create": ["vehicles.operate"],
  "gate.in.create": ["vehicles.operate"],
  // Phase 3 organization/locations reuse established facilities permissions.
  "organization.view": ["facilities.view"],
  "organization.manage": ["facilities.manage", "settings.organization.manage"],
  "locations.view": ["facilities.view", "organization.view"],
  "locations.manage": ["facilities.manage", "organization.manage"],
  // Phase 5 — MaintenanceRequest permissions accept FacilityIssue equivalents during transition
  "maintenance_requests.create": ["facility_issues.report", "cleaning.report_issue"],
  "maintenance_requests.view_own": ["facility_issues.view", "facility_issues.report"],
  "maintenance_requests.view_all": ["facility_issues.view", "facility_issues.manage"],
  "maintenance_requests.triage": ["facility_issues.manage"],
  "maintenance_requests.approve": ["facility_issues.manage"],
  "maintenance_requests.reject": ["facility_issues.manage"],
  "maintenance_requests.convert": ["facility_issues.manage"],
  "maintenance_requests.cancel_own": ["facility_issues.report", "maintenance_requests.create"],
  "maintenance_requests.cancel_any": ["facility_issues.manage"],
  // Phase 6 — granular WO actions accept existing manage / update_status during rollout
  "work_orders.plan": ["work_orders.manage"],
  "work_orders.assign": ["work_orders.manage"],
  "work_orders.start": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.hold": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.resume": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.complete": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.verify": ["work_orders.manage"],
  "work_orders.close": ["work_orders.manage"],
  "work_orders.cancel": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.reopen": ["work_orders.manage"],
  "work_orders.correct": ["work_orders.manage"],
  "warranty.view": ["work_orders.manage", "assets.view", "vehicles.view", "admin.audit.view"],
  "warranty.manage": ["work_orders.manage", "admin.organization.manage"],
  "reliability.view": ["work_orders.manage", "assets.view", "admin.audit.view"],
  "reliability.manage": ["work_orders.manage", "admin.organization.manage"],
  "safety.permit.view": ["work_orders.manage", "assets.view", "admin.audit.view"],
  "safety.permit.manage": ["work_orders.manage", "admin.organization.manage"],
  "maintenance.templates.manage": ["admin.organization.manage", "planning.manage"],
  "admin.features.manage": ["admin.organization.manage", "settings.organization.manage"],
  // Phase 7 — approval engine; manage aliases for admin rollout
  "approvals.view": ["approvals.decide", "approvals.rule.manage", "work_orders.manage"],
  "approvals.view_all": ["approvals.rule.manage"],
  "approvals.decide": ["approvals.rule.manage", "work_orders.manage"],
  "approvals.rule.manage": ["settings.organization.manage"],
  "approvals.override.emergency": ["approvals.rule.manage", "work_orders.manage"],
  // Phase 8 — planning / PM engine; accept work_orders.manage during rollout
  "planning.view": ["planning.manage", "work_orders.manage", "work_orders.plan"],
  "planning.manage": ["work_orders.manage", "work_orders.plan"],
  // Phase 9 — parts / ERP / vendor / cost; accept inventory & WO manage during rollout
  "parts.view": ["inventory.manage", "parts.issue", "parts.return"],
  "parts.issue": ["inventory.manage", "inventory.stock_issue", "part_requests.issue"],
  "parts.return": ["inventory.manage", "inventory.stock_issue", "parts.issue"],
  "erp.mapping.manage": ["inventory.manage", "erp.manage"],
  "vendor.manage": ["inventory.manage", "work_orders.manage"],
  "vendor.portal": ["vendor.manage", "work_orders.view"],
  "contract.manage": ["inventory.manage", "work_orders.manage", "vendor.manage"],
  "cost.view": ["work_orders.manage", "inventory.manage", "cost.adjust"],
  "cost.adjust": ["work_orders.manage", "inventory.manage"],
  // Phase 10 — fleet lifecycle; accept legacy fleet.manage / vehicles.operate during rollout
  "fleet.view": ["fleet.manage", "vehicles.view", "vehicles.operate"],
  "fleet.vehicle.manage": ["fleet.manage", "vehicles.edit", "vehicles.create"],
  "fleet.service.manage": ["fleet.manage", "work_orders.manage"],
  "fleet.inspection.perform": ["fleet.manage", "work_orders.manage"],
  "fleet.tyre.manage": ["fleet.manage", "fleet.vehicle.manage"],
  "fleet.battery.manage": ["fleet.manage", "fleet.vehicle.manage"],
  "fleet.fuel.record": ["fleet.manage", "fleet.log_fuel_trip"],
  "fleet.driver.manage": ["fleet.manage", "vehicles.operate"],
  "fleet.assignment.manage": ["fleet.manage", "fleet.driver.manage"],
  "fleet.document.manage": ["fleet.manage", "vehicle_documents.manage"],
  "fleet.accident.manage": ["fleet.manage", "accidents.manage"],
  "fleet.claim.manage": ["fleet.manage", "insurance_claims.manage"],
  "fleet.fine.manage": ["fleet.manage", "traffic_fines.manage"],
  "gate.check": ["gate.out.create", "gate.in.create", "fleet.manage", "vehicles.operate"],
  "gate.record": ["gate.out.create", "gate.in.create", "fleet.manage"],
  "gate.override": ["gate.override.approve", "fleet.manage"],
  // Phase 11 — domain profiles; accept assets.manage / organization.manage during rollout
  "domains.view": ["assets.manage", "organization.view", "settings.organization.manage"],
  "domains.manage": ["assets.manage", "organization.manage", "settings.organization.manage"],
  // Phase 12 — admin governance; accept existing settings/audit/users permissions during rollout
  "admin.overview.view": ["settings.view", "settings.manage", "settings.organization.manage"],
  "admin.dataquality.view": ["settings.view", "settings.manage", "assets.manage"],
  "admin.audit.view": ["audit.view", "settings.view"],
  "admin.system.view": ["settings.system.manage", "settings.manage"],
  "admin.users.manage": ["users.manage", "users.status.manage"],
  "admin.organization.manage": ["organization.manage", "settings.organization.manage"],
  // Phase 13 — granular report-domain permissions alias to reports.view during rollout
  "reports.view.maintenance": ["reports.view", "reports.performance.view", "reports.operations.view"],
  "reports.view.cost": ["reports.view", "reports.financials.view", "cost.view"],
  "reports.view.fleet": ["reports.view", "reports.vehicle_cost.view", "reports.fuel.view"],
  "reports.view.compliance": ["reports.view", "reports.assets.view", "compliance.view"]
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      headers?: Record<string, unknown>;
    }>();
    const user = request.user;

    if (!user?.sub) {
      throw new UnauthorizedException("Authentication is required");
    }

    // Test harness only: HTTP e2e sets x-test-permissions and must not consume
    // prisma.user.findUnique mocks used by the service under test.
    if (process.env.NODE_ENV === "test" && typeof request.headers?.["x-test-permissions"] === "string") {
      if (user.role === "SUPER_ADMIN") {
        return true;
      }
      return this.assertHasPermissions(this.toPermissionSet(user.permissions), requiredPermissions);
    }

    // Authoritative DB lookup. JWT permission lists are ignored in production
    // (they can remain until token expiry).
    const dbUser = await this.loadDbUser(user.sub);

    if (!dbUser) {
      throw new UnauthorizedException("Authenticated user not found");
    }

    if (dbUser.isActive === false) {
      throw new UnauthorizedException("User account is disabled");
    }

    if (dbUser.lockedUntil && dbUser.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException("User account is temporarily locked");
    }

    // SUPER_ADMIN is determined from DB role only (not JWT claim alone).
    if (dbUser.role.name === "SUPER_ADMIN") {
      return true;
    }

    return this.assertHasPermissions(
      this.toPermissionSet(rolePermissionKeys(dbUser.role)),
      requiredPermissions
    );
  }

  private async loadDbUser(userId: string) {
    if (!this.prisma.user?.findUnique) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        lockedUntil: true,
        role: {
          select: {
            name: true,
            permissionLinks: {
              select: {
                permission: {
                  select: { key: true }
                }
              }
            }
          }
        }
      }
    });
  }

  private assertHasPermissions(
    userPermissions: Set<string>,
    requiredPermissions: string[]
  ): boolean {
    const missingPermissions = requiredPermissions.filter(
      (permission) => !this.hasPermission(userPermissions, permission)
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Missing required permission(s): ${missingPermissions.join(", ")}`
      );
    }

    return true;
  }

  private toPermissionSet(permissions: string[] | undefined): Set<string> {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return new Set();
    }

    return new Set(permissions.map((permission) => permission.trim()).filter(Boolean));
  }

  private hasPermission(userPermissions: Set<string>, requiredPermission: string): boolean {
    if (userPermissions.has(requiredPermission)) {
      return true;
    }

    return (COMPATIBLE_PERMISSION_ALIASES[requiredPermission] ?? []).some((permission) =>
      userPermissions.has(permission)
    );
  }
}
