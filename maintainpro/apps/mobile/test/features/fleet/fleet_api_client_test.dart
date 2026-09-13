import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/features/fleet/data/fleet_api_client.dart';

Response<dynamic> _ok(RequestOptions o, dynamic data) {
  return Response(requestOptions: o, data: data, statusCode: 200);
}

Dio _scripted(
    void Function(RequestOptions, RequestInterceptorHandler) onRequest) {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
  dio.interceptors.add(
    InterceptorsWrapper(onRequest: onRequest),
  );
  return dio;
}

void main() {
  group('FleetApiClient', () {
    test('listVehicles unwraps pagination', () async {
      final dio = _scripted((options, handler) {
        expect(options.method, 'GET');
        expect(options.queryParameters['page'], 2);
        expect(options.queryParameters['pageSize'], 20);
        expect(options.queryParameters['q'], 'KA');
        expect(options.queryParameters['status'], 'AVAILABLE');
        handler.resolve(
          _ok(options, {
            'success': true,
            'data': {
              'items': [
                {
                  'id': 'v1',
                  'registrationNo': 'KA01AB',
                  'status': 'AVAILABLE',
                  'currentMileage': 1000,
                },
              ],
              'pagination': {
                'page': 2,
                'pageSize': 20,
                'total': 25,
                'totalPages': 2,
                'hasNextPage': false,
              },
            },
          }),
        );
      });

      final page = await FleetApiClient(dio).listVehicles(
        q: 'KA',
        status: 'AVAILABLE',
        page: 2,
        pageSize: 20,
      );
      expect(page.items, hasLength(1));
      expect(page.pagination.page, 2);
      expect(page.pagination.hasNextPage, isFalse);
    });

    test('tripStart body omits occurredAt', () async {
      RequestOptions? captured;
      final dio = _scripted((options, handler) {
        captured = options;
        expect(options.path, contains('trip-start'));
        handler.resolve(
          _ok(options, {
            'data': {
              'id': 'trip-1',
              'status': 'IN_PROGRESS',
              'startMileage': 500,
            },
          }),
        );
      });

      final trip = await FleetApiClient(dio).tripStart(
        'v1',
        driverId: 'd1',
        startLocation: 'Yard',
        endLocation: 'Plant',
        startMileage: 500,
        purpose: 'Delivery',
      );

      expect(trip.id, 'trip-1');
      expect(captured, isNotNull);
      expect(captured!.headers['Idempotency-Key'], isNull);
      final body = Map<String, dynamic>.from(captured!.data as Map);
      expect(body.containsKey('occurredAt'), isFalse);
      expect(body.containsKey('startTime'), isFalse);
      expect(body['driverId'], 'd1');
      expect(body['startMileage'], 500);
      expect(body['purpose'], 'Delivery');
    });

    test('fuelLog sends clientActionId in body', () async {
      RequestOptions? captured;
      final dio = _scripted((options, handler) {
        captured = options;
        expect(options.path, contains('fuel-log'));
        handler.resolve(
          _ok(options, {
            'data': {
              'id': 'f1',
              'liters': 40,
              'clientActionId': 'uuid-fuel-1',
            },
          }),
        );
      });

      await FleetApiClient(dio).fuelLog(
        'v1',
        liters: 40,
        costPerLiter: 100,
        mileageAtFuel: 1200,
        clientActionId: 'uuid-fuel-1',
      );

      final body = Map<String, dynamic>.from(captured!.data as Map);
      expect(body['clientActionId'], 'uuid-fuel-1');
      expect(body['liters'], 40);
      expect(body['costPerLiter'], 100);
      expect(body['mileageAtFuel'], 1200);
    });

    test('tripEnd omits occurredAt and Idempotency-Key', () async {
      RequestOptions? captured;
      final dio = _scripted((options, handler) {
        captured = options;
        handler.resolve(
          _ok(options, {
            'data': {'id': 'trip-1', 'status': 'COMPLETED', 'distance': 50},
          }),
        );
      });

      await FleetApiClient(dio).tripEnd(
        'v1',
        tripId: 'trip-1',
        endMileage: 550,
      );

      expect(captured!.headers['Idempotency-Key'], isNull);
      final body = Map<String, dynamic>.from(captured!.data as Map);
      expect(body.containsKey('occurredAt'), isFalse);
      expect(body['tripId'], 'trip-1');
      expect(body['endMileage'], 550);
    });
  });
}
