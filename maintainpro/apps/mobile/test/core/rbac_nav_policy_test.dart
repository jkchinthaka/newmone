import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/rbac/nav_policy.dart';

void main() {
  group('NavPolicy', () {
    test('technician sees work orders under Maintenance', () {
      final groups = NavPolicy.visibleGroups(role: 'TECHNICIAN');
      final maintenance = groups.where((g) => g.id == 'maintenance');
      expect(maintenance, isNotEmpty);
      final ids = maintenance.first.items.map((e) => e.id).toList();
      expect(ids, contains('work-orders'));
    });

    test('security officer sees gate but not admin console', () {
      final groups = NavPolicy.visibleGroups(role: 'SECURITY_OFFICER');
      final allIds = groups.expand((g) => g.items).map((e) => e.id).toSet();
      expect(allIds, contains('fleet-gate'));
      expect(allIds, isNot(contains('admin-console')));
      final gate = groups
          .expand((g) => g.items)
          .where((i) => i.id == 'fleet-gate')
          .single;
      expect(gate.route, '/gate');
    });

    test('admin sees administration group', () {
      final groups = NavPolicy.visibleGroups(role: 'ADMIN');
      expect(groups.any((g) => g.id == 'administration'), isTrue);
    });

    test('driver does not see inventory module', () {
      final groups = NavPolicy.visibleGroups(role: 'DRIVER');
      final allIds = groups.expand((g) => g.items).map((e) => e.id).toSet();
      expect(allIds, isNot(contains('inventory')));
    });

    test('roleAllowed grants SUPER_ADMIN everything', () {
      expect(
        NavPolicy.roleAllowed('SUPER_ADMIN', const ['DRIVER']),
        isTrue,
      );
    });
  });
}
