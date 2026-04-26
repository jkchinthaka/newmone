import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/reports_provider.dart';

// ── Helpers ─────────────────────────────────────────────────────────────────

Widget _glassCard({required Widget child, VoidCallback? onTap}) {
  return ClipRRect(
    borderRadius: BorderRadius.circular(AppRadius.lg),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Material(
        color: AppColors.card.withOpacity(0.7),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: child,
          ),
        ),
      ),
    ),
  );
}

Widget _scaffold({
  required String title,
  required Widget body,
  List<Widget>? actions,
  Widget? fab,
}) {
  return Scaffold(
    extendBodyBehindAppBar: true,
    appBar: AppBar(
      title: Text(title),
      backgroundColor: Colors.transparent,
      elevation: 0,
      actions: actions,
    ),
    floatingActionButton: fab,
    body: Container(
      decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
      child: SafeArea(child: body),
    ),
  );
}

String _fmtValue(dynamic v) {
  if (v == null) return '—';
  if (v is num) {
    if (v == v.roundToDouble()) return v.toStringAsFixed(0);
    return v.toStringAsFixed(2);
  }
  if (v is bool) return v ? 'Yes' : 'No';
  if (v is List) return '${v.length} items';
  if (v is Map) return '${v.length} fields';
  return v.toString();
}

String _humanKey(String k) {
  final spaced =
      k.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}');
  return spaced[0].toUpperCase() + spaced.substring(1);
}

Widget _kvRow(String k, dynamic v) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
            flex: 4,
            child: Text(_humanKey(k), style: AppTextStyles.bodySecondary)),
        Expanded(
            flex: 5,
            child: Text(_fmtValue(v),
                style: AppTextStyles.body, textAlign: TextAlign.right)),
      ],
    ),
  );
}

Widget _renderValue(dynamic value) {
  if (value is Map<String, dynamic>) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: value.entries
          .map((e) => _renderEntry(e.key, e.value))
          .toList(growable: false),
    );
  }
  if (value is List) {
    if (value.isEmpty) {
      return Text('No items', style: AppTextStyles.bodySecondary);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < value.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: _glassCard(
              child: value[i] is Map<String, dynamic>
                  ? _renderValue(value[i])
                  : Text(_fmtValue(value[i]), style: AppTextStyles.body),
            ),
          ),
      ],
    );
  }
  return Text(_fmtValue(value), style: AppTextStyles.body);
}

Widget _renderEntry(String key, dynamic value) {
  if (value is Map<String, dynamic>) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_humanKey(key), style: AppTextStyles.subtitle),
          const SizedBox(height: AppSpacing.xs),
          _glassCard(child: _renderValue(value)),
        ],
      ),
    );
  }
  if (value is List) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: Text(_humanKey(key), style: AppTextStyles.subtitle)),
              Text('${value.length}', style: AppTextStyles.bodySecondary),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          if (value.isEmpty)
            Text('No items', style: AppTextStyles.bodySecondary)
          else
            for (var i = 0; i < value.length && i < 50; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: _glassCard(
                  child: value[i] is Map<String, dynamic>
                      ? _renderValue(value[i])
                      : Text(_fmtValue(value[i]), style: AppTextStyles.body),
                ),
              ),
        ],
      ),
    );
  }
  return _kvRow(key, value);
}

// ── Hub ─────────────────────────────────────────────────────────────────────

class ReportsHubScreen extends StatelessWidget {
  const ReportsHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final tiles = <_ReportTile>[
      _ReportTile('Dashboard', Icons.dashboard_outlined, '/reports/dashboard'),
      _ReportTile('Maintenance Cost', Icons.build_outlined,
          '/reports/maintenance-cost'),
      _ReportTile('Fleet Efficiency', Icons.local_shipping_outlined,
          '/reports/fleet-efficiency'),
      _ReportTile(
          'Downtime', Icons.warning_amber_outlined, '/reports/downtime'),
      _ReportTile(
          'Work Orders', Icons.assignment_outlined, '/reports/work-orders'),
      _ReportTile(
          'Inventory', Icons.inventory_2_outlined, '/reports/inventory'),
      _ReportTile('Utilities', Icons.bolt_outlined, '/reports/utilities'),
    ];

    return _scaffold(
      title: 'Reports',
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md,
            kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
        itemCount: tiles.length,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (_, i) {
          final t = tiles[i];
          return _glassCard(
            onTap: () => context.go(t.path),
            child: Row(
              children: [
                Icon(t.icon, color: AppColors.primaryLight, size: 28),
                const SizedBox(width: AppSpacing.md),
                Expanded(child: Text(t.label, style: AppTextStyles.subtitle)),
                const Icon(Icons.chevron_right, color: AppColors.textSecondary),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ReportTile {
  const _ReportTile(this.label, this.icon, this.path);
  final String label;
  final IconData icon;
  final String path;
}

// ── Generic report renderer ─────────────────────────────────────────────────

class _ReportScreen extends ConsumerWidget {
  const _ReportScreen({required this.title, required this.provider});
  final String title;
  final FutureProvider<Map<String, dynamic>> provider;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(provider);
    return _scaffold(
      title: title,
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: () => ref.invalidate(provider),
        ),
      ],
      body: async.when(
        data: (data) {
          if (data.isEmpty) {
            return Center(
                child: Text('No data', style: AppTextStyles.bodySecondary));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(provider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md,
                  kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
              children: data.entries
                  .map((e) => _renderEntry(e.key, e.value))
                  .toList(growable: false),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Text('Failed to load: $e',
                style: AppTextStyles.body, textAlign: TextAlign.center),
          ),
        ),
      ),
    );
  }
}

class ReportDashboardScreen extends StatelessWidget {
  const ReportDashboardScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      _ReportScreen(title: 'Dashboard', provider: reportsDashboardProvider);
}

class ReportMaintenanceCostScreen extends StatelessWidget {
  const ReportMaintenanceCostScreen({super.key});
  @override
  Widget build(BuildContext context) => _ReportScreen(
      title: 'Maintenance Cost', provider: reportsMaintenanceCostProvider);
}

class ReportFleetEfficiencyScreen extends StatelessWidget {
  const ReportFleetEfficiencyScreen({super.key});
  @override
  Widget build(BuildContext context) => _ReportScreen(
      title: 'Fleet Efficiency', provider: reportsFleetEfficiencyProvider);
}

class ReportDowntimeScreen extends StatelessWidget {
  const ReportDowntimeScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      _ReportScreen(title: 'Downtime', provider: reportsDowntimeProvider);
}

class ReportWorkOrdersScreen extends StatelessWidget {
  const ReportWorkOrdersScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      _ReportScreen(title: 'Work Orders', provider: reportsWorkOrdersProvider);
}

class ReportInventoryScreen extends StatelessWidget {
  const ReportInventoryScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      _ReportScreen(title: 'Inventory', provider: reportsInventoryProvider);
}

class ReportUtilitiesScreen extends StatelessWidget {
  const ReportUtilitiesScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      _ReportScreen(title: 'Utilities', provider: reportsUtilitiesProvider);
}
