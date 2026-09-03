import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';

/// Asset / Maintenance hub — source-backed entry points only.
///
/// Machinery = Asset category MACHINE (no separate Nest model).
/// Service = nextServiceDate / PM schedules (not legacy FMS mock jobs).
class AssetsHubScreen extends ConsumerWidget {
  const AssetsHubScreen({super.key});

  static bool canReadAssets(String role) {
    const allowed = {
      'SUPER_ADMIN',
      'ADMIN',
      'MANAGER',
      'ASSET_MANAGER',
      'SUPERVISOR',
      'MECHANIC',
      'VIEWER',
    };
    return allowed.contains(role.toUpperCase());
  }

  static bool canReadSchedules(String role) {
    const allowed = {
      'SUPER_ADMIN',
      'ADMIN',
      'ASSET_MANAGER',
      'MECHANIC',
    };
    return allowed.contains(role.toUpperCase());
  }

  static bool canReadJobCodes(String role) {
    const allowed = {
      'SUPER_ADMIN',
      'ADMIN',
      'ASSET_MANAGER',
      'TECHNICIAN',
      'MECHANIC',
      'SUPERVISOR',
      'VIEWER',
      'MANAGER',
    };
    return allowed.contains(role.toUpperCase());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(authControllerProvider).user?.role ?? '';
    final offline =
        ref.watch(syncControllerProvider).phase == SyncPhase.offline;

    return Scaffold(
      appBar: AppBar(title: const Text('Assets & maintenance')),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          Text(
            'Field maintenance workspace',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: MpSpacing.sm),
          Text(
            offline
                ? 'Offline — open previously loaded screens only. Mutations require connection.'
                : 'Reads Nest /assets, /maintenance/schedules, and /job-codes. Nest roles remain authoritative.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: MpSpacing.lg),
          if (canReadAssets(role)) ...[
            MpCard(
              child: MpListTile(
                title: 'Assets',
                subtitle: 'Search, status, location, service dates',
                leading: const Icon(Icons.precision_manufacturing_outlined),
                onTap: () => context.push('/assets/list'),
              ),
            ),
            const SizedBox(height: MpSpacing.sm),
            MpCard(
              child: MpListTile(
                title: 'Machinery',
                subtitle: 'Assets with category MACHINE',
                leading: const Icon(Icons.miscellaneous_services_outlined),
                onTap: () => context.push('/assets/list?category=MACHINE'),
              ),
            ),
            const SizedBox(height: MpSpacing.sm),
            MpCard(
              child: MpListTile(
                title: 'Service due',
                subtitle: 'Assets with upcoming or overdue nextServiceDate',
                leading: const Icon(Icons.event_available_outlined),
                onTap: () => context.push('/assets/list?serviceFocus=1'),
              ),
            ),
            const SizedBox(height: MpSpacing.sm),
          ],
          if (canReadSchedules(role)) ...[
            MpCard(
              child: MpListTile(
                title: 'Preventive maintenance',
                subtitle: 'Schedules from Nest (server due state)',
                leading: const Icon(Icons.calendar_month_outlined),
                onTap: () => context.push('/assets/pm'),
              ),
            ),
            const SizedBox(height: MpSpacing.sm),
          ],
          if (canReadJobCodes(role))
            MpCard(
              child: MpListTile(
                title: 'Job codes',
                subtitle: 'Browse / search field job codes',
                leading: const Icon(Icons.qr_code_2_outlined),
                onTap: () => context.push('/assets/job-codes'),
              ),
            ),
          if (!canReadAssets(role) &&
              !canReadSchedules(role) &&
              !canReadJobCodes(role))
            const MpErrorState(
              title: 'No maintenance modules',
              message:
                  'Your Nest role cannot read assets, PM schedules, or job codes.',
            ),
        ],
      ),
    );
  }
}
