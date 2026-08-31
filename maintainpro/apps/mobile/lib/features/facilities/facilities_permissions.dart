/// Role gates mirroring Nest `@Roles` on cleaning issue endpoints.
library;

abstract final class FacilitiesPermissions {
  static const issueCreateRoles = {
    'CLEANER',
    'SUPERVISOR',
    'ADMIN',
    'SUPER_ADMIN',
    'ASSET_MANAGER',
  };

  static const visitReadRoles = {
    'SUPER_ADMIN',
    'ADMIN',
    'SUPERVISOR',
    'CLEANER',
  };

  static bool canReportIssue(String? role) =>
      role != null && issueCreateRoles.contains(role);

  static bool canViewCleaningVisits(String? role) =>
      role != null && visitReadRoles.contains(role);
}
