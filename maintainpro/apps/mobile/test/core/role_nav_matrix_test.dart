import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/rbac/nav_policy.dart';
import 'package:maintainpro_mobile/features/facilities/facilities_permissions.dart';

ModuleNavItem? _findItem(String id, {required String role, List<String> perms = const []}) {
  for (final group in NavPolicy.visibleGroups(role: role, permissions: perms)) {
    for (final item in group.items) {
      if (item.id == id) return item;
    }
  }
  return null;
}

void main() {
  test('TECHNICIAN sees work orders', () {
    expect(_findItem('work-orders', role: 'TECHNICIAN'), isNotNull);
  });

  test('DRIVER does not see work-order admin or inventory roles', () {
    expect(_findItem('inventory', role: 'DRIVER'), isNull);
    expect(_findItem('admin', role: 'DRIVER'), isNull);
  });

  test('SECURITY_OFFICER sees fleet gate module', () {
    expect(_findItem('fleet-gate', role: 'SECURITY_OFFICER'), isNotNull);
  });

  test('INVENTORY_KEEPER sees inventory module', () {
    expect(
      _findItem('inventory', role: 'INVENTORY_KEEPER', perms: const ['inventory.manage']),
      isNotNull,
    );
  });

  test('DRIVER does not see inventory or admin', () {
    expect(_findItem('inventory', role: 'DRIVER'), isNull);
    expect(_findItem('legacy-fms', role: 'DRIVER'), isNull);
  });

  test('CLEANER can report facility issue per Nest roles', () {
    expect(FacilitiesPermissions.canReportIssue('CLEANER'), isTrue);
    expect(FacilitiesPermissions.canReportIssue('VIEWER'), isFalse);
  });

  test('SUPERVISOR can view cleaning visits', () {
    expect(FacilitiesPermissions.canViewCleaningVisits('SUPERVISOR'), isTrue);
    expect(FacilitiesPermissions.canViewCleaningVisits('DRIVER'), isFalse);
  });
}
