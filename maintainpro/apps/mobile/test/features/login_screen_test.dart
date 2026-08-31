import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/i18n/app_strings.dart';
import 'package:maintainpro_mobile/features/auth/presentation/login_screen.dart';
import 'package:maintainpro_mobile/features/more/module_hub_screen.dart';

class _FixedAuthController extends AuthController {
  _FixedAuthController(super.ref, AuthState initial) {
    state = initial;
  }

  @override
  Future<void> bootstrap() async {}
}

void main() {
  testWidgets('invalid email shows one field error and clears stale API banner',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(
              ref,
              const AuthState(
                status: AuthStatus.unauthenticated,
                errorMessage: 'email must be an email',
              ),
            ),
          ),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pump();

    // Nest class-validator copy is mapped to product string (single banner).
    expect(find.text(AppStrings.invalidEmail), findsOneWidget);
    expect(find.text('email must be an email'), findsNothing);

    await tester.enterText(find.byType(TextFormField).first, 'not-an-email');
    await tester.pump();

    // Typing clears the stale API banner.
    expect(find.text(AppStrings.invalidEmail), findsNothing);

    await tester.tap(find.text(AppStrings.signIn));
    await tester.pump();

    // Only the field validator message — no second Nest banner.
    expect(find.text(AppStrings.invalidEmail), findsOneWidget);
    expect(find.text('email must be an email'), findsNothing);
  });

  testWidgets('Module hub Sync center navigates to /sync', (tester) async {
    final router = GoRouter(
      initialLocation: '/more',
      routes: [
        GoRoute(
          path: '/more',
          builder: (_, __) => const ModuleHubScreen(),
        ),
        GoRoute(
          path: '/sync',
          builder: (_, __) => const Scaffold(body: Text('SYNC_SCREEN')),
        ),
        GoRoute(
          path: '/drafts',
          builder: (_, __) => const Scaffold(body: Text('DRAFTS_SCREEN')),
        ),
        GoRoute(
          path: '/settings',
          builder: (_, __) => const Scaffold(body: Text('SETTINGS_SCREEN')),
        ),
        GoRoute(
          path: '/search',
          builder: (_, __) => const Scaffold(body: Text('SEARCH')),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, __) => const Scaffold(body: Text('PROFILE')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(
              ref,
              AuthState(
                status: AuthStatus.authenticated,
                session: AuthSession(
                  accessToken: 't',
                  refreshToken: 'r',
                  user: AuthUser(
                    id: '1',
                    email: 'admin@maintainpro.local',
                    name: 'Admin',
                    role: 'ADMIN',
                    tenantId: 'tenant',
                    permissions: const ['*'],
                  ),
                ),
              ),
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text(AppStrings.syncTitle));
    await tester.pumpAndSettle();

    expect(find.text('SYNC_SCREEN'), findsOneWidget);
  });
}
