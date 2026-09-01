import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/features/admin/admin_hub_screen.dart';
import 'package:maintainpro_mobile/features/admin/admin_users_screen.dart';
import 'package:maintainpro_mobile/features/admin/data/admin_api_client.dart';
import 'package:maintainpro_mobile/features/admin/data/admin_models.dart';
import 'package:maintainpro_mobile/features/reports/reports_hub_screen.dart';
import 'package:maintainpro_mobile/features/reports/data/reports_api_client.dart';
import 'package:maintainpro_mobile/features/reports/reports_screens.dart';

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

AuthState _auth({required String role, List<String> permissions = const []}) {
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

void main() {
  testWidgets('admin hub blocked for manager', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(ref, _auth(role: 'MANAGER')),
          ),
        ],
        child: const MaterialApp(home: AdminHubScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Admin access required'), findsOneWidget);
  });

  testWidgets('admin hub shows sections for ADMIN', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(ref, _auth(role: 'ADMIN')),
          ),
        ],
        child: const MaterialApp(home: AdminHubScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Users'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Audit logs'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Audit logs'), findsOneWidget);
    expect(find.text('System health'), findsOneWidget);
  });

  testWidgets('admin users list renders server rows', (tester) async {
    final dio = _dio({
      '/admin/users': (_) => Response(
            requestOptions: RequestOptions(path: '/admin/users'),
            data: {
              'data': [
                {
                  'id': 'u1',
                  'displayName': 'Ada Admin',
                  'email': 'ada@test.local',
                  'roleName': 'ADMIN',
                  'isActive': true,
                },
              ],
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dioProvider.overrideWithValue(dio),
          adminApiClientProvider.overrideWithValue(AdminApiClient(dio)),
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(ref, _auth(role: 'ADMIN')),
          ),
        ],
        child: const MaterialApp(home: AdminUsersScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Ada Admin'), findsOneWidget);
  });

  testWidgets('super admin user detail shows set password action', (tester) async {
    const user = AdminUserRow(
      id: 'u2',
      displayName: 'Tech User',
      email: 'tech@test.local',
      roleName: 'TECHNICIAN',
      isActive: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(ref, _auth(role: 'SUPER_ADMIN')),
          ),
        ],
        child: const MaterialApp(home: AdminUserDetailScreen(user: user)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Set / reset password'), findsOneWidget);
  });

  testWidgets('reports hub blocked without permission', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(
              ref,
              _auth(role: 'DRIVER', permissions: const []),
            ),
          ),
        ],
        child: const MaterialApp(home: ReportsHubScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Reports access required'), findsOneWidget);
  });

  testWidgets('reports dashboard renders KPI cards', (tester) async {
    final dio = _dio({
      '/reports/dashboard': (_) => Response(
            requestOptions: RequestOptions(path: '/reports/dashboard'),
            data: {
              'data': {
                'summaryCards': [
                  {'label': 'Total Jobs', 'value': 12},
                ],
                'cards': [
                  {'key': 'wo.mttr_hours', 'label': 'MTTR (hours)', 'value': 4.2},
                ],
              },
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dioProvider.overrideWithValue(dio),
          reportsApiClientProvider.overrideWithValue(ReportsApiClient(dio)),
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(
              ref,
              _auth(role: 'MANAGER', permissions: const ['reports.view']),
            ),
          ),
        ],
        child: const MaterialApp(home: ReportsDashboardScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Total Jobs'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
  });
}
