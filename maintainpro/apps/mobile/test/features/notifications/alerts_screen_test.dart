import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/features/alerts/alerts_screen.dart';
import 'package:maintainpro_mobile/features/notifications/data/notifications_api_client.dart';
import 'package:maintainpro_mobile/features/notifications/push_notifications_service.dart';

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

AuthState _auth() {
  return const AuthState(
    status: AuthStatus.authenticated,
    session: AuthSession(
      accessToken: 't',
      refreshToken: 'r',
      user: AuthUser(
        id: 'u1',
        email: 'admin@test.local',
        name: 'Admin',
        role: 'ADMIN',
        tenantId: 't1',
        permissions: [],
      ),
    ),
  );
}

void main() {
  testWidgets('alerts screen renders notification rows', (tester) async {
    final dio = _dio({
      '/notifications': (options) {
        final status = options.queryParameters['status'] ?? 'ALL';
        final items = status == 'UNREAD'
            ? <Map<String, dynamic>>[]
            : [
                {
                  'id': 'n1',
                  'title': 'Work order assigned',
                  'message': 'WO-100 needs attention',
                  'type': 'WORK_ORDER_ASSIGNED',
                  'priority': 'HIGH',
                  'isRead': false,
                  'createdAt': '2026-08-31T10:00:00.000Z',
                  'deepLink': '/work-orders?highlight=wo-100',
                },
              ];
        return Response(
          requestOptions: options,
          data: {
            'data': {'items': items},
            'meta': {'page': 1, 'limit': 20, 'total': items.length},
          },
          statusCode: 200,
        );
      },
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dioProvider.overrideWithValue(dio),
          notificationsApiClientProvider.overrideWithValue(
            NotificationsApiClient(dio),
          ),
          syncControllerProvider.overrideWith(
            (ref) => _FixedSyncController(
              ref,
              const SyncStatus(phase: SyncPhase.idle),
            ),
          ),
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(ref, _auth()),
          ),
          unreadNotificationsCountProvider.overrideWith((ref) => 0),
        ],
        child: const MaterialApp(home: AlertsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Work order assigned'), findsOneWidget);
    expect(find.text('Mark all read'), findsOneWidget);
  });
}
