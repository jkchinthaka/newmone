import '../../core/rbac/permissions.dart';

/// Permission gates mirroring Nest compliance modules.
abstract final class CompliancePermissions {
  static bool canViewCompliance(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, MpPermissions.complianceView);
  }

  static bool canViewDocuments(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.hasAny(perms, const [
      'vehicle_documents.view',
      'compliance.view',
    ]);
  }

  static bool canViewAccidents(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, 'accidents.view');
  }

  static bool canReportAccident(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, 'accidents.report');
  }

  static bool canViewClaims(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, 'insurance_claims.view');
  }

  static bool canViewFines(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.hasAny(perms, const [
      'traffic_fines.view',
      'compliance.view',
    ]);
  }

  static bool canReportFine(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, 'traffic_fines.report');
  }
}
