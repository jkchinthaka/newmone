import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/network/api_exception.dart';
import 'package:maintainpro_mobile/features/work_orders/data/datasources/work_orders_remote_datasource.dart';
import 'package:maintainpro_mobile/features/work_orders/data/work_orders_repository.dart';

/// Resolves canned responses by path substring (no http_mock_adapter dep).
class _ScriptedInterceptor extends Interceptor {
  _ScriptedInterceptor(this.scripts);

  final Map<String, Response<dynamic> Function(RequestOptions)> scripts;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    for (final entry in scripts.entries) {
      if (options.path.contains(entry.key) ||
          options.uri.toString().contains(entry.key)) {
        handler.resolve(entry.value(options));
        return;
      }
    }
    handler.reject(
      DioException(
        requestOptions: options,
        error: 'No script for ${options.method} ${options.path}',
        type: DioExceptionType.unknown,
      ),
    );
  }
}

Dio _dioWith(Map<String, Response<dynamic> Function(RequestOptions)> scripts) {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
  dio.interceptors.add(_ScriptedInterceptor(scripts));
  return dio;
}

Response<dynamic> _ok(RequestOptions o, dynamic data, {int status = 200}) {
  return Response(requestOptions: o, data: data, statusCode: status);
}

Response<dynamic> _err(RequestOptions o, int status, {String? message}) {
  return Response(
    requestOptions: o,
    statusCode: status,
    data: {
      'success': false,
      'message': message ?? 'error $status',
    },
  );
}

void main() {
  group('WorkOrdersEnvelope', () {
    test('unwraps nested data.items', () {
      final list = WorkOrdersEnvelope.extractList({
        'success': true,
        'data': {
          'items': [
            {'id': '1', 'title': 'A', 'status': 'OPEN'},
          ],
        },
      });
      expect(list, hasLength(1));
      expect(list.first['id'], '1');
    });

    test('unwraps map data envelope', () {
      final map = WorkOrdersEnvelope.extractMap({
        'success': true,
        'data': {'id': 'wo1', 'title': 'Pump', 'status': 'OPEN'},
      });
      expect(map?['id'], 'wo1');
    });
  });

  group('parsers', () {
    test('WorkOrderEvidenceItem.fromJson', () {
      final item = WorkOrderEvidenceItem.fromJson({
        'id': 'e1',
        'fileName': 'a.jpg',
        'mimeType': 'image/jpeg',
        'sizeBytes': 12,
        'status': 'UPLOADED',
        'evidenceType': 'BEFORE_PHOTO',
        'verificationStatus': 'PENDING',
      });
      expect(item.id, 'e1');
      expect(item.evidenceType, 'BEFORE_PHOTO');
    });

    test('WorkOrderPartLine.fromJson nested part', () {
      final line = WorkOrderPartLine.fromJson({
        'id': 'l1',
        'partId': 'p1',
        'lineStatus': 'ISSUED',
        'requestedQuantity': 2,
        'unitCost': 5,
        'part': {'id': 'p1', 'name': 'Filter', 'sku': 'F-1'},
      });
      expect(line.partName, 'Filter');
      expect(line.sku, 'F-1');
    });

    test('WorkOrderActivityEvent.fromJson', () {
      final e = WorkOrderActivityEvent.fromJson({
        'id': 'a1',
        'type': 'work_order_created',
        'label': 'Created',
        'timestamp': '2024-01-02T03:04:05.000Z',
        'actorName': 'Ada',
      });
      expect(e.label, 'Created');
      expect(e.actorName, 'Ada');
    });

    test('EvidenceUploadRequestResult treats empty uploadUrl as null', () {
      final r = EvidenceUploadRequestResult.fromJson({
        'ok': true,
        'message': 'ready',
        'attachmentId': 'att1',
        'uploadUrl': null,
      });
      expect(r.uploadUrl, isNull);
      expect(r.attachmentId, 'att1');
    });
  });

  group('InFlightGuard', () {
    test('blocks concurrent run', () async {
      final guard = InFlightGuard();
      var started = 0;
      late Future<int?> first;
      first = guard.run(() async {
        started += 1;
        await Future<void>.delayed(const Duration(milliseconds: 40));
        return 1;
      });
      final second = await guard.run(() async {
        started += 1;
        return 2;
      });
      expect(second, isNull);
      expect(await first, 1);
      expect(started, 1);
    });
  });

  group('WorkOrdersRepository + remote', () {
    test('create includes createdById via datasource', () async {
      Map<String, dynamic>? posted;
      final dio = _dioWith({
        '/work-orders': (o) {
          if (o.method == 'POST') {
            posted = Map<String, dynamic>.from(o.data as Map);
            return _ok(
                o,
                {
                  'success': true,
                  'data': {
                    'id': 'new1',
                    'title': posted!['title'],
                    'status': 'OPEN',
                    'createdById': posted!['createdById'],
                  },
                },
                status: 201);
          }
          return _err(o, 405);
        },
      });
      final remote = WorkOrdersRemoteDataSource(dio);
      final repo = WorkOrdersRepository(dio, remote: remote);
      final created = await repo.create(
        title: 'Fix pump',
        description: 'Leak',
        priority: 'HIGH',
        type: 'CORRECTIVE',
        createdById: '507f1f77bcf86cd799439011',
      );
      expect(posted?['createdById'], '507f1f77bcf86cd799439011');
      expect(created.id, 'new1');
    });

    test('listParts empty', () async {
      final dio = _dioWith({
        '/parts': (o) => _ok(o, {'success': true, 'data': []}),
      });
      final parts = await WorkOrdersRepository(dio).listParts('wo1');
      expect(parts, isEmpty);
    });

    test('listActivity parses entries', () async {
      final dio = _dioWith({
        '/activity': (o) => _ok(o, {
              'success': true,
              'data': {
                'workOrderId': 'wo1',
                'entries': [
                  {
                    'id': 'e1',
                    'type': 'work_started',
                    'label': 'Started',
                    'timestamp': '2024-06-01T12:00:00.000Z',
                    'actorName': 'Tech',
                    'description': null,
                    'source': 'work_order',
                  },
                ],
                'linkedFacilityIssue': null,
                'checkedAt': '2024-06-01T12:00:00.000Z',
              },
            }),
      });
      final events = await WorkOrdersRepository(dio).listActivity('wo1');
      expect(events, hasLength(1));
      expect(events.first.label, 'Started');
    });

    test('evidence upload success path (mock uploadUrl null → confirm)',
        () async {
      final calls = <String>[];
      final dio = _dioWith({
        'upload-request': (o) {
          calls.add('upload-request');
          return _ok(o, {
            'success': true,
            'data': {
              'ok': true,
              'status': 'ready',
              'mode': 'mock',
              'attachmentId': 'att-9',
              'uploadMethod': 'mock',
              'uploadUrl': null,
              'message': 'ready',
            },
          });
        },
        'confirm': (o) {
          calls.add('confirm');
          final body = Map<String, dynamic>.from(o.data as Map);
          expect(body['attachmentId'], 'att-9');
          return _ok(o, {
            'success': true,
            'data': {'ok': true, 'status': 'completed', 'message': 'ok'},
          });
        },
      });
      final repo = WorkOrdersRepository(dio);
      final req = await repo.requestEvidenceUpload(
        workOrderId: 'wo1',
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        clientGeneratedId: 'cid-1',
        source: 'MOBILE',
      );
      expect(req.ok, isTrue);
      expect(req.uploadUrl, isNull);
      await repo.uploadBytesIfNeeded(
        uploadUrl: req.uploadUrl,
        bytes: [1, 2, 3],
        mimeType: 'image/jpeg',
      );
      await repo.confirmEvidenceUpload(
        workOrderId: 'wo1',
        attachmentId: req.attachmentId!,
      );
      expect(calls, ['upload-request', 'confirm']);
    });

    test('evidence upload 500 maps to ServerException', () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            h.reject(
              DioException(
                requestOptions: o,
                response: _err(o, 500, message: 'boom'),
                type: DioExceptionType.badResponse,
              ),
            );
          },
        ),
      );
      expect(
        () => WorkOrdersRepository(dio).requestEvidenceUpload(
          workOrderId: 'wo1',
          fileName: 'a.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1,
        ),
        throwsA(isA<ServerException>()),
      );
    });

    test('401 maps to UnauthorizedException', () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            h.reject(
              DioException(
                requestOptions: o,
                response: _err(o, 401, message: 'auth'),
                type: DioExceptionType.badResponse,
              ),
            );
          },
        ),
      );
      expect(
        () => WorkOrdersRepository(dio).listEvidence('wo1'),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('403 maps to ForbiddenException', () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            h.reject(
              DioException(
                requestOptions: o,
                response: _err(o, 403, message: 'denied'),
                type: DioExceptionType.badResponse,
              ),
            );
          },
        ),
      );
      expect(
        () => WorkOrdersRepository(dio).listParts('wo1'),
        throwsA(isA<ForbiddenException>()),
      );
    });

    test('409 maps to ConflictException', () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            h.reject(
              DioException(
                requestOptions: o,
                response: _err(o, 409, message: 'conflict'),
                type: DioExceptionType.badResponse,
              ),
            );
          },
        ),
      );
      expect(
        () => WorkOrdersRepository(dio).updateStatus(
          id: 'wo1',
          status: 'IN_PROGRESS',
        ),
        throwsA(isA<ConflictException>()),
      );
    });
  });
}
