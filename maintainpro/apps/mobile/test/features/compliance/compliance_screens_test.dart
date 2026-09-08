import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/features/compliance/accidents_list_screen.dart';
import 'package:maintainpro_mobile/features/compliance/compliance_hub_screen.dart';
import 'package:maintainpro_mobile/features/compliance/data/compliance_api_client.dart';
import 'package:maintainpro_mobile/features/compliance/expiring_documents_screen.dart';

class _FixedSyncController extends SyncController {
  _FixedSyncController(super.ref, SyncStatus initial) {
    state = initial;
  }

  @override
  Future<void> syncNow() async {}

  @override
  Future<void> refreshCounts() async {}
}

class _FixedAuthController extends AuthController {
  _FixedAuthController(super.ref, AuthState initial) {
    state = initial;
  }

  @override
  Future<void> bootstrap() async {}
}

class _ScriptedInterceptor extends Interceptor {
  _ScriptedInterceptor(this.scripts);
  final Map<String, Response<dynamic> Function(RequestOptions)> scripts;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    for (final entry in scripts.entries) {
      if (options.path.contains(entry.key)) {
        handler.resolve(entry.value(options));
        return;
      }
    }
    handler.reject(
      DioException(
        requestOptions: options,
        error: 'unscripted ${options.path}',
        type: DioExceptionType.unknown,
      ),
    );
  }
}

Dio _dio(Map<String, Response<dynamic> Function(RequestOptions)> scripts) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test/api'));
  dio.interceptors.add(_ScriptedInterceptor(scripts));
  return dio;
}

AuthState _auth({required List<String> permissions, String role = 'ADMIN'}) {
  return AuthState(
    status: AuthStatus.authenticated,
    session: AuthSession(
      accessToken: 't',
      refreshToken: 'r',
      user: AuthUser(
        id: 'u1',
        email: 'admin@test.local',
        name: 'Admin',
        role: role,
        tenantId: 't1',
        permissions: permissions,
      ),
    ),
  );
}

List<Override> _overrides(Dio dio, AuthState auth) => [
      dioProvider.overrideWithValue(dio),
      complianceApiClientProvider.overrideWithValue(ComplianceApiClient(dio)),
      syncControllerProvider.overrideWith(
        (ref) => _FixedSyncController(ref, const SyncStatus(phase: SyncPhase.idle)),
      ),
      authControllerProvider.overrideWith(
        (ref) => _FixedAuthController(ref, auth),
      ),
    ];

void main() {
  testWidgets('compliance hub shows summary and links', (tester) async {
    final dio = _dio({
      '/compliance/summary': (_) => Response(
            requestOptions: RequestOptions(path: '/compliance/summary'),
            data: {
              'data': {
                'total': 10,
                'compliant': 6,
                'attention': 2,
                'nonCompliant': 2,
              },
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(
          dio,
          _auth(permissions: const ['compliance.view', 'accidents.view']),
        ),
        child: const MaterialApp(home: ComplianceHubScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Compliant: 6'), findsOneWidget);
    expect(find.text('Accidents'), findsOneWidget);
  });

  testWidgets('expiring documents renders server rows', (tester) async {
    final dio = _dio({
      '/compliance/expiring-documents': (_) => Response(
            requestOptions: RequestOptions(path: '/compliance/expiring-documents'),
            data: {
              'data': [
                {
                  'id': 'd1',
                  'documentType': 'INSURANCE',
                  'status': 'VERIFIED',
                  'expiryDate': '2026-09-01T00:00:00.000Z',
                  'vehicle': {'id': 'v1', 'registrationNo': 'ABC-123'},
                },
              ],
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(dio, _auth(permissions: const ['compliance.view'])),
        child: const MaterialApp(home: ExpiringDocumentsScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('INSURANCE'), findsOneWidget);
    expect(find.textContaining('ABC-123'), findsOneWidget);
  });

  testWidgets('accidents list shows report FAB when permitted', (tester) async {
    final dio = _dio({
      '/accidents': (_) => Response(
            requestOptions: RequestOptions(path: '/accidents'),
            data: {
              'data': [
                {
                  'id': 'a1',
                  'reportNumber': 'ACC-2026-00001',
                  'status': 'OPEN',
                  'severity': 'MINOR',
                  'location': 'Gate A',
                  'description': 'Minor bump',
                },
              ],
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(
          dio,
          _auth(permissions: const ['accidents.view', 'accidents.report']),
        ),
        child: const MaterialApp(home: AccidentsListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('ACC-2026-00001'), findsOneWidget);
    expect(find.text('Report'), findsOneWidget);
  });
}
