import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart';
import '../../../core/widgets/loading_shimmer.dart';
import '../../../core/widgets/stat_card.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../notifications/presentation/providers/notifications_provider.dart';
import '../data/models/dashboard_summary.dart';
import 'providers/dashboard_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final asyncSummary = ref.watch(dashboardProvider);
    final unread = ref.watch(notificationsProvider).unreadCount;

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(dashboardProvider);
              await ref
                  .read(notificationsProvider.notifier)
                  .refreshUnreadCount();
              await ref.read(dashboardProvider.future);
            },
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.xl,
                        AppSpacing.lg, AppSpacing.xl, AppSpacing.md),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_greeting(),
                                  style: AppTextStyles.bodySecondary),
                              const SizedBox(height: 2),
                              Text(
                                user?.displayName ?? 'Welcome',
                                style: AppTextStyles.display
                                    .copyWith(fontSize: 22),
                              ),
                            ],
                          ),
                        ),
                        _NotificationBell(
                          unread: unread,
                          onTap: () => context.go('/notifications'),
                        ),
                      ],
                    ),
                  ),
                ),
                asyncSummary.when(
                  loading: () => const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(AppSpacing.xl),
                      child: Column(
                        children: [
                          CardShimmer(height: 120),
                          SizedBox(height: AppSpacing.md),
                          CardShimmer(height: 120),
                        ],
                      ),
                    ),
                  ),
                  error: (e, _) => SliverFillRemaining(
                    hasScrollBody: false,
                    child: AppErrorWidget(
                      message: e.toString(),
                      onRetry: () => ref.invalidate(dashboardProvider),
                    ),
                  ),
                  data: (summary) => _DashboardContent(summary: summary),
                ),
                const SliverToBoxAdapter(
                  child: SizedBox(height: AppSpacing.huge),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
}

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({required this.summary});
  final DashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    return SliverList(
      delegate: SliverChildListDelegate([
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: AppSpacing.md,
            crossAxisSpacing: AppSpacing.md,
            childAspectRatio: 1.3,
            children: [
              StatCard(
                icon: Icons.assignment_rounded,
                value: '${summary.openWorkOrders}',
                label: 'Open Orders',
                color: AppColors.statusOpen,
                onTap: () => GoRouter.of(context).go('/work-orders'),
              ),
              StatCard(
                icon: Icons.warning_amber_rounded,
                value: '${summary.criticalAlerts}',
                label: 'Critical Alerts',
                color: AppColors.error,
              ),
              StatCard(
                icon: Icons.precision_manufacturing_rounded,
                value: '${summary.assetsTotal}',
                label: 'Assets',
                trend: summary.assetsDown > 0
                    ? '${summary.assetsDown} down'
                    : 'all up',
                trendUp: summary.assetsDown == 0,
                color: AppColors.primaryLight,
                onTap: () => GoRouter.of(context).go('/assets'),
              ),
              StatCard(
                icon: Icons.event_repeat_rounded,
                value: '${summary.maintenanceDue}',
                label: 'Maint. Due',
                color: AppColors.warning,
                onTap: () => GoRouter.of(context).go('/maintenance'),
              ),
              StatCard(
                icon: Icons.local_shipping_rounded,
                value: '${summary.fleetActive}',
                label: 'Active Fleet',
                color: AppColors.info,
                onTap: () => GoRouter.of(context).go('/fleet'),
              ),
              StatCard(
                icon: Icons.local_gas_station_rounded,
                value: summary.fuelMonthLiters.toStringAsFixed(0),
                label: 'Fuel (L) MTD',
                color: AppColors.secondary,
                onTap: () => GoRouter.of(context).go('/fleet/fuel'),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Row(
            children: [
              Text('Recent activity', style: AppTextStyles.title),
              const Spacer(),
              TextButton(
                onPressed: () => GoRouter.of(context).go('/work-orders'),
                child: const Text('View all'),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        if (summary.recent.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacing.xl),
            child: EmptyStateWidget(
              icon: Icons.inbox_outlined,
              title: 'Nothing to show',
              message: 'Recent items will appear here.',
            ),
          )
        else
          ...summary.recent.map((r) => _RecentTile(item: r)),
      ]),
    );
  }
}

class _RecentTile extends StatelessWidget {
  const _RecentTile({required this.item});
  final DashboardRecent item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.sm),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          onTap: () {
            switch (item.kind.toLowerCase()) {
              case 'work_order':
              case 'workorder':
                GoRouter.of(context).go('/work-orders/${item.id}');
                break;
              case 'asset':
                GoRouter.of(context).go('/assets/${item.id}');
                break;
              default:
            }
          },
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.card.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Icon(
                    _iconFor(item.kind),
                    color: AppColors.primaryLight,
                    size: 20,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.subtitle),
                      const SizedBox(height: 2),
                      Text(item.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption),
                    ],
                  ),
                ),
                if (item.status != null) StatusBadge(status: item.status!),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _iconFor(String kind) {
    switch (kind.toLowerCase()) {
      case 'work_order':
      case 'workorder':
        return Icons.assignment_rounded;
      case 'asset':
        return Icons.precision_manufacturing_rounded;
      case 'maintenance':
        return Icons.event_repeat_rounded;
      case 'fleet':
      case 'vehicle':
        return Icons.local_shipping_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }
}

class _NotificationBell extends StatelessWidget {
  const _NotificationBell({required this.unread, required this.onTap});
  final int unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.full),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Material(
              color: AppColors.card.withValues(alpha: 0.7),
              shape: const CircleBorder(
                side: BorderSide(color: AppColors.border),
              ),
              child: IconButton(
                onPressed: onTap,
                icon: const Icon(Icons.notifications_outlined,
                    color: AppColors.textPrimary),
              ),
            ),
            if (unread > 0)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  constraints:
                      const BoxConstraints(minWidth: 18, minHeight: 18),
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: AppColors.surface, width: 1),
                  ),
                  child: Text(
                    unread > 99 ? '99+' : '$unread',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
