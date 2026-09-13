import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/rbac/nav_policy.dart';

/// Documents tenant isolation expectations for admin/report API calls.
/// Nest enforces X-Tenant-Id + JWT; mobile must never trust client tenantId for auth.
void main() {
  test('admin console route is not exposed to manager in nav', () {
    final groups = NavPolicy.visibleGroups(role: 'MANAGER');
    final adminConsole = groups
        .expand((g) => g.items)
        .where((i) => i.id == 'admin-console');
    expect(adminConsole, isEmpty);
  });

  test('reports visible with reports.view permission', () {
    final groups = NavPolicy.visibleGroups(
      role: 'MANAGER',
      permissions: const ['reports.view'],
    );
    final reports = groups
        .expand((g) => g.items)
        .where((i) => i.route == '/reports');
    expect(reports, isNotEmpty);
  });

  test('driver does not see reports without permission', () {
    final groups = NavPolicy.visibleGroups(role: 'DRIVER');
    final reports = groups
        .expand((g) => g.items)
        .where((i) => i.route == '/reports');
    expect(reports, isEmpty);
  });

  test('farm nav routes to /farm not /more', () {
    final groups = NavPolicy.visibleGroups(role: 'FARM_MANAGER');
    final farmItem = groups
        .expand((g) => g.items)
        .firstWhere((i) => i.id == 'farm');
    expect(farmItem.route, '/farm');
  });
}
