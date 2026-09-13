import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/rbac/nav_policy.dart';
import 'package:maintainpro_mobile/core/rbac/permissions.dart';
import 'package:maintainpro_mobile/core/rbac/role_home_config.dart';

void main() {
  group('Fleet RBAC', () {
    test('permission constants match API keys', () {
      expect(MpPermissions.vehiclesView, 'vehicles.view');
      expect(MpPermissions.vehiclesEdit, 'vehicles.edit');
      expect(MpPermissions.vehiclesOperate, 'vehicles.operate');
      expect(MpPermissions.vehiclesCreate, 'vehicles.create');
      expect(MpPermissions.vehiclesDelete, 'vehicles.delete');
    });

    test('Fleet and Vehicles nav routes', () {
      final groups = NavPolicy.visibleGroups(
        role: 'MANAGER',
        permissions: const ['vehicles.view'],
      );
      final items = groups.expand((g) => g.items).toList();
      final fleet = items.where((i) => i.id == 'fleet').single;
      final vehicles = items.where((i) => i.id == 'vehicles').single;
      expect(fleet.route, '/fleet');
      expect(vehicles.route, '/fleet/vehicles');
    });

    test('DRIVER home cards include My Vehicle at /fleet/vehicles', () {
      final cards = RoleHomeConfig.cardsForRole('DRIVER');
      final myVehicle = cards.where((c) => c.id == 'my-vehicle').single;
      expect(myVehicle.route, '/fleet/vehicles');
    });

    test('MANAGER home includes fleet hub', () {
      final cards = RoleHomeConfig.cardsForRole('MANAGER');
      final fleet = cards.where((c) => c.id == 'fleet').single;
      expect(fleet.route, '/fleet');
    });

    test('TECHNICIAN home includes vehicles context', () {
      final cards = RoleHomeConfig.cardsForRole('TECHNICIAN');
      final vehicles = cards.where((c) => c.id == 'vehicles').single;
      expect(vehicles.route, '/fleet/vehicles');
    });

    test('Gate remains at /gate for security', () {
      final cards = RoleHomeConfig.cardsForRole('SECURITY_OFFICER');
      final gate = cards.where((c) => c.id == 'fleet-gate').single;
      expect(gate.route, '/gate');
    });
  });
}
