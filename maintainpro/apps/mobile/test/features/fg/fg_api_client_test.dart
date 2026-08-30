import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/network/api_exception.dart';
import 'package:maintainpro_mobile/features/fg/data/fg_api_client.dart';
import 'package:maintainpro_mobile/features/fg/data/fg_models.dart';

class _ScriptedInterceptor extends Interceptor {
  _ScriptedInterceptor(this.scripts);

  final Map<String, Response<dynamic> Function(RequestOptions)> scripts;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    for (final entry in scripts.entries) {
      if (options.path.contains(entry.key) ||
          options.uri.toString().contains(entry.key)) {
        final build = entry.value;
        final response = build(options);
        if (response.statusCode != null && response.statusCode! >= 400) {
          handler.reject(
            DioException(
              requestOptions: options,
              response: response,
              type: DioExceptionType.badResponse,
            ),
          );
          return;
        }
        handler.resolve(response);
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
  group('FgApiClient', () {
    test('bootstrap before call sets session ready', () async {
      var bootstraps = 0;
      final dio = _dioWith({
        'session/bootstrap': (o) {
          bootstraps += 1;
          return _ok(o, {
            'success': true,
            'data': {
              'authenticated': true,
              'actor': {'email': 'a@b.c'},
              'expiresAt': '2099-01-01T00:00:00.000Z',
            },
            'message': 'ready',
          });
        },
        'cl30/vehicles': (o) => _ok(o, {
              'data': {
                'results': [
                  {
                    'id': 'v1',
                    'label': 'TRK-1',
                    'selectable': true,
                    'registrationNo': 'ABC',
                  },
                ],
              },
            }),
      });
      final client = FgApiClient(dio);
      final vehicles = await client.searchCl30Vehicles('bus');
      expect(bootstraps, 1);
      expect(client.isBootstrapped, isTrue);
      expect(vehicles, hasLength(1));
      expect(vehicles.first.selectable, isTrue);
    });

    test('open requires occurrenceToken', () async {
      final dio = _dioWith({
        'session/bootstrap': (o) => _ok(o, {
              'data': {'authenticated': true},
            }),
        'records/open': (o) {
          final body = Map<String, dynamic>.from(o.data as Map);
          expect(body.containsKey('occurrenceToken'), isTrue);
          expect(body['occurrenceToken'], isNotEmpty);
          return _ok(o, {
            'data': {
              'record': {
                'id': 'r1',
                'status': 'DRAFT',
                'formCode': kCl30FormCode
              },
              'idempotent': false,
            },
          });
        },
      });
      final client = FgApiClient(dio);
      final opened = await client.openCl30Record(
        occurrenceToken: 'token-abc-123',
      );
      expect(opened.record.id, 'r1');
      expect(opened.idempotent, isFalse);
    });

    test('open rejects invalid occurrenceToken client-side', () async {
      final client = FgApiClient(_dioWith({}));
      expect(
        () => client.openCl30Record(occurrenceToken: 'short'),
        throwsA(isA<BadRequestException>()),
      );
    });

    test('review decision enums enforced', () async {
      final dio = _dioWith({
        'session/bootstrap': (o) => _ok(o, {
              'data': {'authenticated': true}
            }),
      });
      final client = FgApiClient(dio);
      expect(
        () => client.reviewDecision(
          submissionId: 's1',
          decision: 'NOPE',
        ),
        throwsA(isA<BadRequestException>()),
      );
    });

    test('qa decision enums enforced', () async {
      final dio = _dioWith({
        'session/bootstrap': (o) => _ok(o, {
              'data': {'authenticated': true}
            }),
      });
      final client = FgApiClient(dio);
      expect(
        () => client.qaDecision(submissionId: 's1', decision: 'MAYBE'),
        throwsA(isA<BadRequestException>()),
      );
    });

    test('review APPROVED posts decision + idempotencyKey', () async {
      Map<String, dynamic>? posted;
      final dio = _dioWith({
        'session/bootstrap': (o) => _ok(o, {
              'data': {'authenticated': true}
            }),
        'decision': (o) {
          posted = Map<String, dynamic>.from(o.data as Map);
          return _ok(o, {
            'data': {'decision': 'APPROVED'},
          });
        },
      });
      final client = FgApiClient(dio);
      await client.reviewDecision(
        submissionId: 'sub-1',
        decision: 'APPROVED',
        reviewNote: 'ok',
        idempotencyKey: 'idem-1',
      );
      expect(posted?['decision'], 'APPROVED');
      expect(posted?['reviewNote'], 'ok');
      expect(posted?['idempotencyKey'], 'idem-1');
    });

    test('qa maps reviewNote to note for Nest BFF', () async {
      Map<String, dynamic>? posted;
      final dio = _dioWith({
        'session/bootstrap': (o) => _ok(o, {
              'data': {'authenticated': true}
            }),
        'decision': (o) {
          posted = Map<String, dynamic>.from(o.data as Map);
          return _ok(o, {
            'data': {'decision': 'RELEASE'}
          });
        },
      });
      final client = FgApiClient(dio);
      await client.qaDecision(
        submissionId: 'sub-2',
        decision: 'RELEASE',
        reviewNote: 'ship it',
        idempotencyKey: 'idem-2',
      );
      expect(posted?['decision'], 'RELEASE');
      expect(posted?['note'], 'ship it');
      expect(posted?['idempotencyKey'], 'idem-2');
    });

    test('403 maps to ForbiddenException', () async {
      final dio = _dioWith({
        'session/bootstrap': (o) => _err(o, 403, message: 'no fg access'),
      });
      final client = FgApiClient(dio);
      expect(
        () => client.bootstrap(),
        throwsA(isA<ForbiddenException>()),
      );
    });

    test('unwraps raw { data, message } without success', () async {
      final dio = _dioWith({
        'session/bootstrap': (o) => _ok(o, {
              'data': {'authenticated': true, 'expiresAt': 'x'},
              'message': 'ready',
            }),
      });
      final client = FgApiClient(dio);
      final status = await client.bootstrap();
      expect(status.authenticated, isTrue);
      expect(status.expiresAt, 'x');
    });
  });

  group('FgRecordDetail parser', () {
    test('reads editor sections fieldName/label/options', () {
      final detail = FgRecordDetail.fromJson({
        'record': {'id': 'r1', 'status': 'DRAFT'},
        'readOnly': false,
        'actions': {'canEdit': true, 'canSubmit': true},
        'editor': {
          'draftVersion': 3,
          'expectedDraftVersion': 3,
          'sections': [
            {
              'title': 'Freezer truck',
              'fields': [
                {
                  'fieldName': 'resp_1',
                  'code': 'VEHICLE',
                  'label': 'Truck',
                  'required': true,
                  'responseType': 'TEXT',
                  'value': 'ABC',
                  'isVehicleField': true,
                  'options': [],
                },
                {
                  'fieldName': 'resp_2',
                  'code': 'CLEAN',
                  'label': 'Clean',
                  'required': true,
                  'responseType': 'YES_NO',
                  'value': 'YES',
                  'options': [
                    {'value': 'YES', 'label': 'PASS'},
                    {'value': 'NO', 'label': 'FAIL'},
                  ],
                },
              ],
            },
          ],
        },
      });
      expect(detail.draftVersion, 3);
      expect(detail.editorSections, hasLength(1));
      expect(detail.fieldValues['resp_1'], 'ABC');
      expect(detail.editorSections.first.fields[1].isChoice, isTrue);
    });
  });
}
