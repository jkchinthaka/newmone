import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import 'data/reports_models.dart';

/// Advanced Management Reports hub — permission-aware, source-backed categories.
class ReportsHubScreen extends ConsumerWidget {
  const ReportsHubScreen({super.key});

  bool _canView(List<String> perms, String role) {
    final r = role.toUpperCase();
    if (r == 'SUPER_ADMIN' || r == 'ADMIN') return true;
    return MpPermissions.has(perms, MpPermissions.reportsView) ||
        perms.any((p) => p.startsWith('reports.'));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final perms = user?.permissions ?? const [];
    final role = user?.role ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('Management Reports')),
      body: !_canView(perms, role)
          ? const MpErrorState(
              title: 'Reports access required',
              message:
                  'Your role needs reports.* permissions. Nest RBAC remains authoritative.',
            )
          : ListView(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              children: [
                const MpPageHeader(
                  title: 'Management reports',
                  subtitle:
                      'Server-calculated KPIs and operational intelligence. Export available on module reports.',
                ),
                const MpSectionHeader(title: 'Executive'),
                MpHubTile(
                  icon: Icons.dashboard_outlined,
                  title: 'Management dashboard',
                  subtitle: 'Role-variant KPIs',
                  onTap: () => context.push('/reports/dashboard'),
                ),
                MpHubTile(
                  icon: Icons.insights_outlined,
                  title: 'Management intelligence',
                  subtitle: 'Profitability & cost summaries',
                  onTap: () => context.push('/reports/management'),
                ),
                const MpSectionHeader(title: 'Operations & maintenance'),
                MpHubTile(
                  icon: Icons.warning_amber_outlined,
                  title: 'Maintenance exceptions',
                  subtitle: 'Exception cards',
                  onTap: () => context.push('/reports/maintenance-exceptions'),
                ),
                ...kReportModules.entries.map(
                  (e) => MpHubTile(
                    icon: Icons.table_chart_outlined,
                    title: e.value,
                    subtitle: 'Module report · ${e.key}',
                    onTap: () => context.push('/reports/modules/${e.key}'),
                  ),
                ),
                const MpSectionHeader(title: 'Domain'),
                MpHubTile(
                  icon: Icons.apartment_outlined,
                  title: 'Facilities aging',
                  subtitle: 'WO aging by facility',
                  onTap: () => context.push('/reports/facilities-aging'),
                ),
                MpHubTile(
                  icon: Icons.cloud_sync_outlined,
                  title: 'ERP monitoring',
                  subtitle: 'Integration status',
                  onTap: () => context.push('/reports/erp'),
                ),
                MpHubTile(
                  icon: Icons.verified_user_outlined,
                  title: 'Compliance',
                  subtitle: 'Documents & exceptions',
                  onTap: () => context.push('/compliance'),
                ),
                MpHubTile(
                  icon: Icons.fact_check_outlined,
                  title: 'FG history',
                  subtitle: 'CL18–CL39 via FG hub',
                  onTap: () => context.push('/fg'),
                ),
                MpHubTile(
                  icon: Icons.history,
                  title: 'Audit trail',
                  subtitle: 'System activity',
                  onTap: () => context.push('/admin/audit'),
                ),
              ],
            ),
    );
  }
}
