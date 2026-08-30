import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/features/fg/data/fg_api_client.dart';
import 'package:maintainpro_mobile/features/fg/fg_hub_screen.dart';

class _ScriptedInterceptor extends Interceptor {
  _ScriptedInterceptor(this.scripts);

  final Map<String, Response<dynamic> Function(RequestOptions)> scripts;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    for (final entry in scripts.entries) {
      if (options.path.contains(entry.key)) {
        final res = entry.value(options);
        if (res.statusCode != null && res.statusCode! >= 400) {
          handler.reject(
            DioException(
              requestOptions: options,
              response: res,
              type: DioExceptionType.badResponse,
            ),
          );
          return;
        }
        handler.resolve(res);
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

class _FixedAuthController extends AuthController {
  _FixedAuthController(super.ref, AuthState initial) {
    state = initial;
  }

  @override
  Future<void> bootstrap() async {}
}

AuthState _auth({
  required List<String> permissions,
  String role = 'TECHNICIAN',
}) {
  return AuthState(
    status: AuthStatus.authenticated,
    session: AuthSession(
      accessToken: 't',
      refreshToken: 'r',
      user: AuthUser(
        id: 'u1',
        email: 'u@example.com',
        name: 'User',
        role: role,
        tenantId: 'tenant-1',
        permissions: permissions,
      ),
    ),
  );
}

void main() {
  testWidgets('hub blocked without fg.access', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(ref, _auth(permissions: const [])),
          ),
        ],
        child: const MaterialApp(home: FgHubScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('FG access required'), findsOneWidget);
  });

  testWidgets('hub shows actions after bootstrap success', (tester) async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
    dio.interceptors.add(
      _ScriptedInterceptor({
        'session/bootstrap': (o) => Response(
              requestOptions: o,
              statusCode: 200,
              data: {
                'success': true,
                'data': {
                  'authenticated': true,
                  'expiresAt': '2099-01-01T00:00:00.000Z',
                },
              },
            ),
      }),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(
              ref,
              _auth(
                permissions: const [
                  'fg.access',
                  'fg.recording.view',
                  'fg.recording.create',
                  'fg.review.view',
                  'fg.qa.view',
                ],
              ),
            ),
          ),
          dioProvider.overrideWithValue(dio),
          fgApiClientProvider.overrideWithValue(FgApiClient(dio)),
        ],
        child: const MaterialApp(home: FgHubScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Session ready'), findsOneWidget);
    expect(find.text('New CL30'), findsOneWidget);
    expect(find.text('My drafts'), findsOneWidget);
    expect(find.text('Supervisor reviews'), findsOneWidget);

    // ListView may not build below-the-fold tiles until scrolled.
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();

    expect(find.text('QA'), findsOneWidget);
    expect(find.text('History'), findsOneWidget);
  });
}
