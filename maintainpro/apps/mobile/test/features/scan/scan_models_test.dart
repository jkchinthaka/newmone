import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/features/scan/data/scan_models.dart';

void main() {
  group('mapScanTargetToMobileRoute', () {
    test('vehicle routes to fleet for default roles', () {
      expect(
        mapScanTargetToMobileRoute(
          target: const ScanTarget(
            type: 'VEHICLE',
            id: 'v1',
            route: '/fleet/vehicles/v1',
            matchedBy: 'id',
            title: 'ABC',
            subtitle: 'Toyota',
          ),
          isSecurityOfficer: false,
        ),
        '/fleet/vehicles/v1',
      );
    });

    test('vehicle routes to gate for security officer', () {
      expect(
        mapScanTargetToMobileRoute(
          target: const ScanTarget(
            type: 'VEHICLE',
            id: 'v1',
            route: '/fleet/vehicles/v1',
            matchedBy: 'id',
            title: 'ABC',
            subtitle: 'Toyota',
          ),
          isSecurityOfficer: true,
        ),
        '/gate/vehicle/v1',
      );
    });

    test('work order maps to mobile detail', () {
      expect(
        mapScanTargetToMobileRoute(
          target: const ScanTarget(
            type: 'WORK_ORDER',
            id: 'wo1',
            route: '/work-orders/wo1',
            matchedBy: 'id',
            title: 'WO-1',
            subtitle: 'Open',
          ),
          isSecurityOfficer: false,
        ),
        '/work-orders/wo1',
      );
    });
  });
}
