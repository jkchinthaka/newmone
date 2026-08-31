import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/features/facilities/data/facilities_api_client.dart';
import 'package:maintainpro_mobile/features/facilities/facilities_hub_screen.dart';
import 'package:maintainpro_mobile/features/facilities/facility_issues_list_screen.dart';
import 'package:maintainpro_mobile/features/facilities/facility_rooms_list_screen.dart';
import 'package:maintainpro_mobile/features/facilities/utilities_meters_screen.dart';

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

AuthState _auth({
  required List<String> permissions,
  String role = 'ADMIN',
}) {
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

List<Override> _baseOverrides(
  Dio dio, {
  required AuthState auth,
}) =>
    [
      dioProvider.overrideWithValue(dio),
      facilitiesApiClientProvider.overrideWithValue(FacilitiesApiClient(dio)),
      syncControllerProvider.overrideWith(
        (ref) => _FixedSyncController(
          ref,
          const SyncStatus(phase: SyncPhase.idle),
        ),
      ),
      authControllerProvider.overrideWith(
        (ref) => _FixedAuthController(ref, auth),
      ),
    ];

void main() {
  testWidgets('facilities hub shows read links for admin', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          _dio({}),
          auth: _auth(permissions: const ['facilities.view']),
        ),
        child: const MaterialApp(home: FacilitiesHubScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Rooms & sites'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Utility meters'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Utility meters'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Mutations blocked on mobile'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Mutations blocked on mobile'), findsOneWidget);
  });

  testWidgets('facilities hub blocked without facilities.view', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          _dio({}),
          auth: _auth(permissions: const [], role: 'VIEWER'),
        ),
        child: const MaterialApp(home: FacilitiesHubScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('facilities.view'), findsWidgets);
  });

  testWidgets('facility rooms list renders server rooms', (tester) async {
    final dio = _dio({
      '/facilities/rooms': (_) => Response(
            requestOptions: RequestOptions(path: '/facilities/rooms'),
            data: {
              'data': [
                {
                  'id': 'r1',
                  'name': 'Lab 101',
                  'code': 'LAB-101',
                  'status': 'ACTIVE',
                  'floorName': 'Level 1',
                  'buildingName': 'Main',
                },
              ],
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          dio,
          auth: _auth(permissions: const ['facilities.view']),
        ),
        child: const MaterialApp(home: FacilityRoomsListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Lab 101'), findsOneWidget);
  });

  testWidgets('facility issues list shows report FAB for supervisor', (tester) async {
    final dio = _dio({
      '/cleaning/issues': (_) => Response(
            requestOptions: RequestOptions(path: '/cleaning/issues'),
            data: {
              'data': [
                {
                  'id': 'i1',
                  'title': 'Broken light',
                  'severity': 'MEDIUM',
                  'status': 'OPEN',
                },
              ],
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          dio,
          auth: _auth(permissions: const [], role: 'SUPERVISOR'),
        ),
        child: const MaterialApp(home: FacilityIssuesListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Broken light'), findsOneWidget);
    expect(find.text('Report'), findsOneWidget);
  });

  testWidgets('utility meters list renders meter type', (tester) async {
    final dio = _dio({
      '/utilities/meters': (_) => Response(
            requestOptions: RequestOptions(path: '/utilities/meters'),
            data: {
              'data': [
                {
                  'id': 'm1',
                  'meterNumber': 'EM-001',
                  'type': 'ELECTRICITY',
                  'unit': 'kWh',
                  'location': 'Plant A',
                },
              ],
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          dio,
          auth: _auth(permissions: const ['utilities.manage']),
        ),
        child: const MaterialApp(home: UtilitiesMetersScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('EM-001'), findsOneWidget);
    expect(find.textContaining('ELECTRICITY'), findsOneWidget);
  });
}
