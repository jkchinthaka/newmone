import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/features/gate/data/gate_api_client.dart';

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
  group('GateApiClient', () {
    test('searchVehicles unwraps Nest envelope items', () async {
      final dio = _scripted((options, handler) {
        expect(options.method, 'GET');
        expect(options.queryParameters['q'], 'KA01');
        handler.resolve(
          _ok(options, {
            'success': true,
            'data': {
              'items': [
                {
                  'id': '507f1f77bcf86cd799439011',
                  'registrationNo': 'KA01AB1234',
                  'status': 'AVAILABLE',
                  'currentMileage': 12000,
                },
              ],
            },
          }),
        );
      });

      final list = await GateApiClient(dio).searchVehicles('KA01');
      expect(list, hasLength(1));
      expect(list.first.registrationNo, 'KA01AB1234');
      expect(list.first.currentMileage, 12000);
    });

    test('getEligibility parses blocked and canOverride', () async {
      final dio = _scripted((options, handler) {
        expect(options.path, contains('gate-eligibility'));
        handler.resolve(
          _ok(options, {
            'data': {
              'allowed': false,
              'blocked': true,
              'blockReasons': ['Insurance expired', 'Critical WO open'],
              'canOverride': true,
              'vehicle': {
                'id': 'v1',
                'registrationNo': 'TN09X1',
                'status': 'AVAILABLE',
                'currentMileage': 500,
                'driverId': 'd1',
              },
            },
          }),
        );
      });

      final el = await GateApiClient(dio).getEligibility('v1');
      expect(el.blocked, isTrue);
      expect(el.allowed, isFalse);
      expect(el.canOverride, isTrue);
      expect(el.blockReasons, hasLength(2));
      expect(el.vehicle?.registrationNo, 'TN09X1');
    });

    test('gateOut sends Idempotency-Key and omits approvedByUserId', () async {
      RequestOptions? captured;
      final dio = _scripted((options, handler) {
        captured = options;
        handler.resolve(
          _ok(options, {
            'data': {
              'allowed': true,
              'blocked': false,
              'movement': {
                'id': 'm1',
                'movementType': 'OUT',
                'status': 'ALLOWED',
              },
            },
          }),
        );
      });

      final result = await GateApiClient(dio).gateOut(
        'v1',
        meterReading: 501,
        driverId: 'd1',
        checkpoint: 'Main',
        notes: 'ok',
        allowOverride: true,
        overrideReason: 'Supervisor approved',
        idempotencyKey: 'idem-abc-123',
      );

      expect(result.allowed, isTrue);
      expect(captured, isNotNull);
      expect(captured!.headers['Idempotency-Key'], 'idem-abc-123');
      final body = Map<String, dynamic>.from(captured!.data as Map);
      expect(body.containsKey('approvedByUserId'), isFalse);
      expect(body.containsKey('occurredAt'), isFalse);
      expect(body['meterReading'], 501);
      expect(body['allowOverride'], isTrue);
      expect(body['overrideReason'], 'Supervisor approved');
    });

    test('gateIn sends Idempotency-Key header', () async {
      RequestOptions? captured;
      final dio = _scripted((options, handler) {
        captured = options;
        expect(options.path, contains('gate-in'));
        handler.resolve(
          _ok(options, {
            'data': {
              'movement': {
                'id': 'm2',
                'movementType': 'IN',
                'status': 'ALLOWED',
              },
            },
          }),
        );
      });

      await GateApiClient(dio).gateIn(
        'v1',
        meterReading: 510,
        checkpoint: 'East',
        idempotencyKey: 'idem-in-1',
      );

      expect(captured!.headers['Idempotency-Key'], 'idem-in-1');
      final body = Map<String, dynamic>.from(captured!.data as Map);
      expect(body.containsKey('approvedByUserId'), isFalse);
      expect(body.containsKey('occurredAt'), isFalse);
      expect(body['meterReading'], 510);
    });
  });
}
