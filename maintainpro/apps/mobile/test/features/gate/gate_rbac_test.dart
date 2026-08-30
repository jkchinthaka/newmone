import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/rbac/nav_policy.dart';
import 'package:maintainpro_mobile/core/rbac/permissions.dart';
import 'package:maintainpro_mobile/core/rbac/role_home_config.dart';
import 'package:maintainpro_mobile/features/gate/data/gate_models.dart';

void main() {
  group('Gate RBAC', () {
    test('permission constants match API keys', () {
      expect(MpPermissions.gateInCreate, 'gate.in.create');
      expect(MpPermissions.gateOutCreate, 'gate.out.create');
      expect(MpPermissions.gateOverrideApprove, 'gate.override.approve');
      expect(MpPermissions.vehiclesView, 'vehicles.view');
    });

    test('SECURITY_OFFICER sees fleet-gate routed to /gate', () {
      final groups = NavPolicy.visibleGroups(role: 'SECURITY_OFFICER');
      final gate = groups
          .expand((g) => g.items)
          .where((i) => i.id == 'fleet-gate')
          .single;
      expect(gate.route, '/gate');
      expect(
        gate.requiredPermissions,
        containsAll(['gate.in.create', 'gate.out.create', 'vehicles.view']),
      );
    });

    test('security home card routes to /gate', () {
      final cards = RoleHomeConfig.cardsForRole('SECURITY_OFFICER');
      final gate = cards.where((c) => c.id == 'fleet-gate').single;
      expect(gate.route, '/gate');
    });

    test('MpPermissions.has supports gate.out.create via wildcard', () {
      expect(
        MpPermissions.has(const ['gate.*'], MpPermissions.gateOutCreate),
        isTrue,
      );
      expect(
        MpPermissions.has(const ['vehicles.view'], MpPermissions.gateOutCreate),
        isFalse,
      );
    });

    test('override UI helper is dual-gated', () {
      expect(
        canShowGateOverrideUi(
          eligibilityCanOverride: true,
          userHasOverridePermission: MpPermissions.has(
            const ['gate.override.approve'],
            MpPermissions.gateOverrideApprove,
          ),
        ),
        isTrue,
      );
    });
  });
}
