import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/features/fleet/data/fleet_models.dart';

void main() {
  group('Vehicle', () {
    test('parses list fields and nested driver', () {
      final v = Vehicle.fromJson({
        'id': '507f1f77bcf86cd799439011',
        'registrationNo': 'KA01AB1234',
        'make': 'Tata',
        'vehicleModel': 'Ace',
        'status': 'AVAILABLE',
        'currentMileage': 12000,
        'serviceStatus': 'DUE_SOON',
        'driver': {
          'id': 'd1',
          'user': {'firstName': 'Ravi', 'lastName': 'K'},
        },
      });
      expect(v.displayLabel, 'KA01AB1234');
      expect(v.driverId, 'd1');
      expect(v.driverName, 'Ravi K');
      expect(v.healthLabel, VehicleHealthLabel.attention);
    });

    test('health maps overdue to critical', () {
      expect(
        healthFromServiceStatus('OVERDUE'),
        VehicleHealthLabel.critical,
      );
      expect(
        healthFromServiceStatus('ON_SCHEDULE'),
        VehicleHealthLabel.healthy,
      );
      expect(
        healthFromServiceStatus('ON_SCHEDULE', hasCriticalAlert: true),
        VehicleHealthLabel.critical,
      );
    });
  });

  group('VehicleListPage', () {
    test('unwraps items + pagination', () {
      final page = VehicleListPage.fromJson({
        'items': [
          {'id': 'v1', 'registrationNo': 'TN09X1', 'status': 'IN_USE'},
        ],
        'pagination': {
          'page': 1,
          'pageSize': 20,
          'total': 1,
          'totalPages': 1,
          'hasNextPage': false,
        },
      });
      expect(page.items, hasLength(1));
      expect(page.pagination.hasNextPage, isFalse);
      expect(page.items.first.status, 'IN_USE');
    });
  });

  group('TripLog', () {
    test('detects IN_PROGRESS', () {
      final t = TripLog.fromJson({
        'id': 't1',
        'status': 'IN_PROGRESS',
        'startMileage': 100,
      });
      expect(t.isInProgress, isTrue);
      expect(
        TripLog.fromJson({'id': 't2', 'status': 'COMPLETED'}).isInProgress,
        isFalse,
      );
    });
  });

  group('FuelAnalytics', () {
    test('parses numeric fields defensively', () {
      final a = FuelAnalytics.fromJson({
        'totalLiters': '12.5',
        'totalCost': 500,
        'avgCostPerLiter': 40,
        'averageConsumptionLPer100Km': 8.2,
        'abnormalUsageCount': 1,
      });
      expect(a.totalLiters, 12.5);
      expect(a.abnormalUsageCount, 1);
    });
  });

  group('unwrapFleetData', () {
    test('unwraps Nest envelope', () {
      final data = unwrapFleetData({
        'success': true,
        'data': {'id': 'v1'},
      });
      expect(asStringKeyedMap(data)?['id'], 'v1');
    });
  });
}
