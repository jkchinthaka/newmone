import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/features/gate/gate_home_screen.dart';

class _FixedSyncController extends SyncController {
  _FixedSyncController(super.ref, SyncStatus initial) {
    state = initial;
  }

  @override
  Future<void> syncNow() async {}

  @override
  Future<void> refreshCounts() async {}
}

void main() {
  testWidgets('gate home shows offline authorization message', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          syncControllerProvider.overrideWith(
            (ref) => _FixedSyncController(
              ref,
              const SyncStatus(phase: SyncPhase.offline),
            ),
          ),
        ],
        child: const MaterialApp(home: GateHomeScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Gate authorization requires connection'), findsWidgets);
    expect(find.text('Vehicle gate'), findsOneWidget);
  });
}
