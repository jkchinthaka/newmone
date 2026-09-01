import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/features/admin/admin_hub_screen.dart';
import 'package:maintainpro_mobile/features/home/home_screen.dart';
import 'package:maintainpro_mobile/features/reports/reports_hub_screen.dart';

class _FixedAuthController extends AuthController {
  _FixedAuthController(super.ref, AuthState initial) {
    state = initial;
  }

  @override
  Future<void> bootstrap() async {}
}

class _FixedSyncController extends SyncController {
  _FixedSyncController(super.ref, SyncStatus initial) {
    state = initial;
  }

  @override
  Future<void> syncNow() async {}

  @override
  Future<void> refreshCounts() async {}
}

AuthState _superAdminAuth() {
  return AuthState(
    status: AuthStatus.authenticated,
    session: AuthSession(
      accessToken: 't',
      refreshToken: 'r',
      user: AuthUser(
        id: '1',
        email: 'superadmin@maintainpro.local',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        tenantId: 'tenant',
        permissions: const ['*'],
      ),
    ),
  );
}

Widget _harness({
  required Widget child,
  double textScale = 1.0,
}) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(
        (ref) => _FixedAuthController(ref, _superAdminAuth()),
      ),
      syncControllerProvider.overrideWith(
        (ref) => _FixedSyncController(
          ref,
          const SyncStatus(phase: SyncPhase.idle, pendingCount: 2),
        ),
      ),
    ],
    child: MediaQuery(
      data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
      child: MaterialApp(home: child),
    ),
  );
}

void main() {
  const largeText = 1.3;

  testWidgets('Home at large text scale has no overflow', (tester) async {
    await tester.pumpWidget(_harness(child: const HomeScreen(), textScale: largeText));
    await tester.pumpAndSettle();

    expect(find.textContaining('Hello'), findsOneWidget);
    expect(find.text('Quick actions'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Admin hub at large text scale has no overflow', (tester) async {
    await tester.pumpWidget(
      _harness(child: const AdminHubScreen(), textScale: largeText),
    );
    await tester.pumpAndSettle();

    expect(find.text('Admin Console'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Reports hub at large text scale has no overflow', (tester) async {
    await tester.pumpWidget(
      _harness(child: const ReportsHubScreen(), textScale: largeText),
    );
    await tester.pumpAndSettle();

    expect(find.text('Management reports'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
