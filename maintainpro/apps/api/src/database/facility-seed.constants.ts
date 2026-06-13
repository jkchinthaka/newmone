import { RoleName } from "@prisma/client";

export const FACILITY_PERMISSION_KEYS = [
  "facilities.view",
  "facilities.manage",
  "facility_issues.view",
  "facility_issues.report",
  "facility_issues.manage",
  "facility_inspections.view",
  "facility_inspections.manage"
] as const;

export type FacilityPermissionKey = (typeof FACILITY_PERMISSION_KEYS)[number];

export const FACILITY_HIERARCHY_MODELS = ["Property", "Building", "Floor", "Room"] as const;

export const FACILITY_ROLE_NAMES = [RoleName.FACILITY_MANAGER, RoleName.BUILDING_SUPERVISOR] as const;

export const FACILITY_MANAGER_PERMISSIONS: readonly string[] = [
  "dashboard.view",
  "modules.view_all",
  "reports.view",
  "users.view",
  "settings.view",
  "facilities.view",
  "facilities.manage",
  "facility_issues.view",
  "facility_issues.report",
  "facility_issues.manage",
  "facility_inspections.view",
  "facility_inspections.manage",
  "cleaning.report_issue",
  "cleaning.manage"
];

export const BUILDING_SUPERVISOR_PERMISSIONS: readonly string[] = [
  "dashboard.view",
  "modules.view_all",
  "reports.view",
  "facilities.view",
  "facility_issues.view",
  "facility_issues.report",
  "facility_issues.manage",
  "facility_inspections.view",
  "facility_inspections.manage",
  "cleaning.report_issue",
  "cleaning.sign_off",
  "cleaning.manage"
];

export const FACILITY_MANAGER_SHARED_VIEW_PERMISSIONS = [
  "facilities.view",
  "facility_issues.view",
  "facility_inspections.view"
] as const;
