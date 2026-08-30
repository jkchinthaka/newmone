import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/features/gate/data/gate_models.dart';

void main() {
  group('GateEligibility', () {
    test('parses blocked with canOverride', () {
      final el = GateEligibility.fromJson({
        'allowed': false,
        'blocked': true,
        'blockReasons': ['Compliance NON_COMPLIANT', 'Service overdue'],
        'canOverride': true,
        'vehicle': {
          'id': 'abc',
          'registrationNo': 'MH12AB99',
          'currentMileage': 1000,
          'status': 'AVAILABLE',
        },
      });
      expect(el.blocked, isTrue);
      expect(el.allowed, isFalse);
      expect(el.canOverride, isTrue);
      expect(el.blockReasons, contains('Service overdue'));
      expect(el.vehicle?.displayLabel, 'MH12AB99');
    });

    test('parses allowed without reasons', () {
      final el = GateEligibility.fromJson({
        'allowed': true,
        'blocked': false,
        'blockReasons': [],
        'canOverride': false,
      });
      expect(el.allowed, isTrue);
      expect(el.blocked, isFalse);
      expect(el.canOverride, isFalse);
      expect(el.blockReasons, isEmpty);
    });

    test('tolerates string blockReasons', () {
      final el = GateEligibility.fromJson({
        'allowed': false,
        'blocked': true,
        'blockReasons': 'Single reason',
        'canOverride': false,
      });
      expect(el.blockReasons, ['Single reason']);
    });
  });

  group('canShowGateOverrideUi', () {
    test('requires both server flag and permission', () {
      expect(
        canShowGateOverrideUi(
          eligibilityCanOverride: true,
          userHasOverridePermission: true,
        ),
        isTrue,
      );
      expect(
        canShowGateOverrideUi(
          eligibilityCanOverride: true,
          userHasOverridePermission: false,
        ),
        isFalse,
      );
      expect(
        canShowGateOverrideUi(
          eligibilityCanOverride: false,
          userHasOverridePermission: true,
        ),
        isFalse,
      );
    });
  });

  group('looksLikeVehicleId', () {
    test('matches ObjectId and UUID', () {
      expect(looksLikeVehicleId('507f1f77bcf86cd799439011'), isTrue);
      expect(
        looksLikeVehicleId('550e8400-e29b-41d4-a716-446655440000'),
        isTrue,
      );
      expect(looksLikeVehicleId('KA01AB1234'), isFalse);
    });
  });

  group('GateOutResult', () {
    test('parses blocked response', () {
      final r = GateOutResult.fromJson({
        'allowed': false,
        'blocked': true,
        'blockedReason': 'Insurance expired',
        'movement': {'id': 'm1', 'movementType': 'OUT', 'status': 'BLOCKED'},
      });
      expect(r.blocked, isTrue);
      expect(r.movement?.isBlocked, isTrue);
    });
  });
}
