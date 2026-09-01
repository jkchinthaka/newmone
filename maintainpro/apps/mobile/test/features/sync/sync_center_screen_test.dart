import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/auth/secure_token_store.dart';
import 'package:maintainpro_mobile/core/database/app_database.dart';
import 'package:maintainpro_mobile/core/i18n/app_strings.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/core/tenant/tenant_context.dart';
import 'package:maintainpro_mobile/design_system/design_system.dart';
import 'package:maintainpro_mobile/features/sync/sync_center_screen.dart';
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

void main() {
  testWidgets('MpButton expand:false survives unbounded Row width', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Row(
            children: [
              Expanded(child: Text('status')),
              MpButton(label: 'Sync', expand: false),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Sync'), findsOneWidget);
  });

  testWidgets('Sync center lays out without infinite width crash', (tester) async {
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
                    id: 'u1',
                    email: 'a@b.co',
                    name: 'A',
                    role: 'ADMIN',
                    tenantId: 'tenant-1',
                  ),
                ),
              ),
            ),
          ),
          syncControllerProvider.overrideWith(
            (ref) => _FixedSyncController(
              ref,
              const SyncStatus(phase: SyncPhase.idle, pendingCount: 0),
            ),
          ),
        ],
        child: const MaterialApp(home: SyncCenterScreen()),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 5));

    expect(tester.takeException(), isNull);
    expect(find.text(AppStrings.syncTitle), findsOneWidget);
    expect(find.textContaining('Status:'), findsOneWidget);
    expect(find.text(AppStrings.emptySync), findsOneWidget);
  });

  testWidgets('Sync center shows status card and empty outbox with database',
      (tester) async {
    final db = AppDatabase(NativeDatabase.memory());
    addTearDown(db.close);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          tenantContextProvider.overrideWith(
            (ref) => TenantContextNotifier(ref.watch(secureTokenStoreProvider))
              ..state = const TenantContext(tenantId: 'tenant-1'),
          ),
          authControllerProvider.overrideWith(
            (ref) => _FixedAuthController(
              ref,
              AuthState(
                status: AuthStatus.authenticated,
                session: AuthSession(
                  accessToken: 't',
                  refreshToken: 'r',
                  user: AuthUser(
                    id: 'u1',
                    email: 'a@b.co',
                    name: 'A',
                    role: 'ADMIN',
                    tenantId: 'tenant-1',
                  ),
                ),
              ),
            ),
          ),
          syncControllerProvider.overrideWith(
            (ref) => _FixedSyncController(
              ref,
              const SyncStatus(phase: SyncPhase.idle, pendingCount: 0),
            ),
          ),
        ],
        child: const MaterialApp(home: SyncCenterScreen()),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 5));

    expect(tester.takeException(), isNull);
    expect(find.textContaining('Status:'), findsOneWidget);
    expect(find.text(AppStrings.emptySync), findsOneWidget);
  });
}
