import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/models/app_user.dart';
import 'providers/fleet_provider.dart';

class FleetHubScreen extends ConsumerWidget {
  const FleetHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final isDriver = user?.role == UserRole.driver;
    final summary = ref.watch(vehicleSummaryProvider);
    final liveAlerts = ref.watch(fleetAlertsProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Fleet'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'Live alerts',
            onPressed: () => context.push('/fleet/alerts'),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(vehicleSummaryProvider);
              ref.invalidate(fleetAlertsProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                summary.when(
                  data: (s) => _SummaryCard(summary: s),
                  loading: () => const _SkeletonCard(),
                  error: (e, _) =>
                      _ErrorCard(message: 'Failed to load summary: $e'),
                ),
                const SizedBox(height: AppSpacing.md),
                liveAlerts.maybeWhen(
                  data: (alerts) => alerts.isEmpty
                      ? const SizedBox.shrink()
                      : _AlertsBanner(count: alerts.length),
                  orElse: () => const SizedBox.shrink(),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.directions_car_outlined,
                  title: 'Vehicles',
                  subtitle: 'Browse, status, services & assignments',
                  accent: AppColors.primaryLight,
                  onTap: () => context.push('/fleet/vehicles'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.map_outlined,
                  title: 'Live map',
                  subtitle: 'Realtime vehicle positions',
                  accent: AppColors.info,
                  onTap: () => context.push('/fleet/map'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.badge_outlined,
                  title: 'Drivers',
                  subtitle: 'License status, assignments',
                  accent: AppColors.secondary,
                  onTap: () => context.push('/fleet/drivers'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.local_gas_station_outlined,
                  title: isDriver ? 'Log fuel' : 'Fuel logs',
                  subtitle: 'Refuels, stations & efficiency',
                  accent: AppColors.warning,
                  onTap: () => context.push('/fleet/fuel'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.route_outlined,
                  title: 'Trips',
                  subtitle: 'Recent trips, distances & purpose',
                  accent: AppColors.success,
                  onTap: () => context.push('/fleet/trips'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary});
  final dynamic summary;

  @override
  Widget build(BuildContext context) {
    final s = summary;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          color: AppColors.card.withValues(alpha: 0.7),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Fleet at a glance', style: AppTextStyles.subtitle),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _Stat(
                      label: 'Total',
                      value: '${s.totalVehicles}',
                      color: AppColors.primaryLight),
                  _Stat(
                      label: 'Available',
                      value: '${s.availableVehicles}',
                      color: AppColors.success),
                  _Stat(
                      label: 'In use',
                      value: '${s.vehiclesInUse}',
                      color: AppColors.info),
                  _Stat(
                      label: 'Maintenance',
                      value: '${s.vehiclesUnderMaintenance}',
                      color: AppColors.warning),
                  _Stat(
                      label: 'Out of service',
                      value: '${s.vehiclesOutOfService}',
                      color: AppColors.error),
                  _Stat(
                      label: 'Service due',
                      value: '${s.upcomingServices}',
                      color: AppColors.statusOnHold),
                  _Stat(
                      label: 'Overdue',
                      value: '${s.overdueMaintenance}',
                      color: AppColors.statusOverdue),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(value, style: AppTextStyles.subtitle.copyWith(color: color)),
          Text(label, style: AppTextStyles.caption),
        ],
      ),
    );
  }
}

class _AlertsBanner extends StatelessWidget {
  const _AlertsBanner({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
      ),
      child: Row(children: [
        const Icon(Icons.warning_amber_rounded, color: AppColors.warning),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text('$count active fleet alert${count == 1 ? '' : 's'}',
              style: AppTextStyles.body),
        ),
        TextButton(
          onPressed: () => GoRouter.of(context).push('/fleet/alerts'),
          child: const Text('View'),
        )
      ]),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withValues(alpha: 0.7),
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Icon(icon, color: accent),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: AppTextStyles.subtitle),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(subtitle, style: AppTextStyles.bodySecondary),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.textSecondary),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: const Center(child: CircularProgressIndicator()),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Text(message,
          style: AppTextStyles.body.copyWith(color: AppColors.error)),
    );
  }
}
