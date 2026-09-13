import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/i18n/app_strings.dart';
import '../../core/network/dio_client.dart';
import '../../core/offline/sync_controller.dart';
import '../../core/tenant/tenant_context.dart';
import '../../design_system/design_system.dart';

final _connectivityProvider = StreamProvider<List<ConnectivityResult>>((ref) {
  return Connectivity().onConnectivityChanged;
});

class DiagnosticsScreen extends ConsumerWidget {
  const DiagnosticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appConfigProvider);
    final auth = ref.watch(authControllerProvider);
    final tenant = ref.watch(tenantContextProvider);
    final sync = ref.watch(syncControllerProvider);
    final connectivity = ref.watch(_connectivityProvider);

    final online = connectivity.maybeWhen(
      data: (r) => r.any((e) => e != ConnectivityResult.none),
      orElse: () => true,
    );

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.diagnosticsTitle)),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          MpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Connectivity',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: MpSpacing.sm),
                MpStatusChip(
                  label: online ? AppStrings.online : AppStrings.offline,
                  tone: online ? MpStatusTone.success : MpStatusTone.warning,
                ),
              ],
            ),
          ),
          const SizedBox(height: MpSpacing.md),
          MpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Session', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: MpSpacing.sm),
                Text('Authenticated: ${auth.isAuthenticated}'),
                Text('User: ${auth.user?.email ?? '—'}'),
                Text('Role: ${auth.user?.role ?? '—'}'),
                Text('Tenant: ${tenant.tenantId ?? '—'}'),
              ],
            ),
          ),
          const SizedBox(height: MpSpacing.md),
          MpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('API', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: MpSpacing.sm),
                Text('Flavor: ${config.flavor.label}'),
                Text('Base: ${config.apiRoot}'),
                Text('Sync phase: ${sync.phase.name}'),
                Text('Pending outbox: ${sync.pendingCount}'),
              ],
            ),
          ),
          const SizedBox(height: MpSpacing.xl),
          MpButton(
            label: 'Run sync now',
            icon: Icons.sync,
            onPressed: () =>
                ref.read(syncControllerProvider.notifier).syncNow(),
          ),
        ],
      ),
    );
  }
}
