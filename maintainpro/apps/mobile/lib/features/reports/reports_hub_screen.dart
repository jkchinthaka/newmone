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
                Text(
                  'Advanced reports',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: MpSpacing.sm),
                Text(
                  'All KPIs and totals are server-calculated. Flutter is presentation only.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: MpSpacing.lg),
                const MpSectionHeader(title: 'Executive'),
                _tile(context, Icons.dashboard_outlined, 'Management dashboard',
                    'Role-variant KPIs', '/reports/dashboard'),
                _tile(
                    context,
                    Icons.insights_outlined,
                    'Management intelligence',
                    'Profitability & cost summaries',
                    '/reports/management'),
                const SizedBox(height: MpSpacing.md),
                const MpSectionHeader(title: 'Operations & maintenance'),
                _tile(context, Icons.warning_amber_outlined,
                    'Maintenance exceptions', 'Exception cards',
                    '/reports/maintenance-exceptions'),
                ...kReportModules.entries.map(
                  (e) => _tile(
                    context,
                    Icons.table_chart_outlined,
                    e.value,
                    'Module report · ${e.key}',
                    '/reports/modules/${e.key}',
                  ),
                ),
                const SizedBox(height: MpSpacing.md),
                const MpSectionHeader(title: 'Domain'),
                _tile(context, Icons.apartment_outlined, 'Facilities aging',
                    'WO aging by facility', '/reports/facilities-aging'),
                _tile(context, Icons.cloud_sync_outlined, 'ERP monitoring',
                    'Integration status', '/reports/erp'),
                _tile(context, Icons.verified_user_outlined, 'Compliance',
                    'Documents & exceptions', '/compliance'),
                _tile(context, Icons.fact_check_outlined, 'FG history',
                    'CL18–CL39 via FG hub', '/fg'),
                _tile(context, Icons.history, 'Audit trail',
                    'System activity', '/admin/audit'),
              ],
            ),
    );
  }

  Widget _tile(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
    String route,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MpSpacing.sm),
      child: MpCard(
        onTap: () => context.push(route),
        child: ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon),
          title: Text(title),
          subtitle: Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
        ),
      ),
    );
  }
}
