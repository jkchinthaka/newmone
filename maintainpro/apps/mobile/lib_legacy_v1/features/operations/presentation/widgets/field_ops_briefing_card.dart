import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_text_styles.dart';
import '../../../../core/network/connectivity_provider.dart';
import '../../../../core/offline/offline_sync.dart';
import '../../../../shared/models/app_user.dart';
import '../../../ai/data/models/field_insight.dart';
import '../../../ai/presentation/providers/ai_provider.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class FieldOpsBriefingCard extends ConsumerWidget {
  const FieldOpsBriefingCard({
    super.key,
    this.focusAreaOverride,
    this.maxInsights = 3,
  });

  final String? focusAreaOverride;
  final int maxInsights;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null || !user.role.supportsFieldOpsBriefing) {
      return const SizedBox.shrink();
    }

    final config = _FieldOpsRoleConfig.resolve(user.role, focusAreaOverride);
    final isOnline = ref.watch(isOnlineProvider);
    final queueStats = ref.watch(offlineQueueStatsProvider);
    final syncState = ref.watch(offlineSyncStateProvider);
    final insightsAsync = ref.watch(fieldInsightsProvider(config.focusArea));

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.card.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(config.title, style: AppTextStyles.subtitle),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          config.subtitle,
                          style: AppTextStyles.bodySecondary,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Open scanner',
                    onPressed: () => context.push('/operations/scan'),
                    icon: const Icon(Icons.qr_code_scanner_rounded),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  _StatusChip(
                    icon: isOnline ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                    label: isOnline ? 'Online' : 'Offline',
                    color: isOnline ? AppColors.success : AppColors.warning,
                  ),
                  queueStats.when(
                    data: (stats) => _StatusChip(
                      icon: Icons.upload_file_rounded,
                      label: '${stats.pending} queued',
                      color: stats.pending > 0
                          ? AppColors.warning
                          : AppColors.primaryLight,
                    ),
                    loading: () => const _StatusChip(
                      icon: Icons.upload_file_rounded,
                      label: 'Queue…',
                      color: AppColors.primaryLight,
                    ),
                    error: (_, __) => const _StatusChip(
                      icon: Icons.error_outline_rounded,
                      label: 'Queue unavailable',
                      color: AppColors.error,
                    ),
                  ),
                  queueStats.when(
                    data: (stats) => _StatusChip(
                      icon: syncState.replaying
                          ? Icons.sync_rounded
                          : Icons.report_problem_outlined,
                      label: syncState.replaying
                          ? 'Syncing'
                          : '${stats.failed} failed',
                      color: syncState.replaying
                          ? AppColors.info
                          : (stats.failed > 0
                              ? AppColors.error
                              : AppColors.success),
                    ),
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  for (final action in config.actions)
                    _ActionChip(
                      icon: action.icon,
                      label: action.label,
                      onTap: () => context.push(action.route),
                    ),
                  queueStats.when(
                    data: (stats) {
                      if (!isOnline || stats.total == 0) {
                        return const SizedBox.shrink();
                      }

                      return _ActionChip(
                        icon: Icons.sync_rounded,
                        label: syncState.replaying ? 'Syncing…' : 'Replay queue',
                        onTap: syncState.replaying
                            ? null
                            : () async {
                                try {
                                  final result = await ref
                                      .read(offlineSyncControllerProvider)
                                      .replayPending();
                                  if (!context.mounted) return;
                                  final message = result.failedCount > 0
                                      ? 'Replayed ${result.replayedCount} item(s), ${result.failedCount} still need attention.'
                                      : 'Replayed ${result.replayedCount} queued item(s).';
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(message)),
                                  );
                                } catch (error) {
                                  if (!context.mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Queue replay failed: $error'),
                                    ),
                                  );
                                }
                              },
                      );
                    },
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  const Text('Priority insights', style: AppTextStyles.subtitle),
                  const Spacer(),
                  TextButton(
                    onPressed: () => ref.invalidate(
                      fieldInsightsProvider(config.focusArea),
                    ),
                    child: const Text('Refresh'),
                  ),
                ],
              ),
              insightsAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  child: LinearProgressIndicator(minHeight: 2),
                ),
                error: (error, _) => Text(
                  'Field insights are temporarily unavailable: $error',
                  style: AppTextStyles.bodySecondary,
                ),
                data: (snapshot) {
                  final items = snapshot.insights.take(maxInsights).toList();
                  if (items.isEmpty) {
                    return Text(
                      snapshot.smartSuggestions.isNotEmpty
                          ? snapshot.smartSuggestions.first
                          : 'No high-priority predictive issues are active right now.',
                      style: AppTextStyles.bodySecondary,
                    );
                  }

                  return Column(
                    children: [
                      for (final insight in items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                          child: _InsightTile(insight: insight),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldOpsRoleConfig {
  const _FieldOpsRoleConfig({
    required this.title,
    required this.subtitle,
    required this.focusArea,
    required this.actions,
  });

  final String title;
  final String subtitle;
  final String focusArea;
  final List<_FieldOpsAction> actions;

  static _FieldOpsRoleConfig resolve(UserRole role, String? focusAreaOverride) {
    final normalizedFocusArea = focusAreaOverride?.trim().toUpperCase();

    if (role == UserRole.securityOfficer) {
      return _FieldOpsRoleConfig(
        title: 'Checkpoint briefing',
        subtitle: 'Scan inbound assets fast and keep exceptions visible.',
        focusArea: normalizedFocusArea ?? 'FLEET',
        actions: const [
          _FieldOpsAction(
            label: 'Scan QR',
            icon: Icons.qr_code_scanner_rounded,
            route: '/operations/scan',
          ),
          _FieldOpsAction(
            label: 'Alerts',
            icon: Icons.notifications_active_outlined,
            route: '/notifications',
          ),
          _FieldOpsAction(
            label: 'Vehicles',
            icon: Icons.local_shipping_outlined,
            route: '/fleet/vehicles',
          ),
        ],
      );
    }

    if (role == UserRole.driver) {
      return _FieldOpsRoleConfig(
        title: 'Driver briefing',
        subtitle: 'Keep scan, fueling, and trip follow-up one tap away.',
        focusArea: normalizedFocusArea ?? 'FLEET',
        actions: const [
          _FieldOpsAction(
            label: 'Scan QR',
            icon: Icons.qr_code_scanner_rounded,
            route: '/operations/scan',
          ),
          _FieldOpsAction(
            label: 'Log fuel',
            icon: Icons.local_gas_station_outlined,
            route: '/fleet/fuel',
          ),
          _FieldOpsAction(
            label: 'Trips',
            icon: Icons.route_outlined,
            route: '/fleet/trips',
          ),
        ],
      );
    }

    if (role.isTechnicianLike) {
      return _FieldOpsRoleConfig(
        title: 'Technician briefing',
        subtitle: 'Prioritize work orders, scans, and predictive service risk.',
        focusArea: normalizedFocusArea ?? 'MAINTENANCE',
        actions: const [
          _FieldOpsAction(
            label: 'Scan QR',
            icon: Icons.qr_code_scanner_rounded,
            route: '/operations/scan',
          ),
          _FieldOpsAction(
            label: 'Work orders',
            icon: Icons.assignment_outlined,
            route: '/work-orders',
          ),
          _FieldOpsAction(
            label: 'Alerts',
            icon: Icons.psychology_outlined,
            route: '/maintenance/alerts',
          ),
        ],
      );
    }

    return _FieldOpsRoleConfig(
      title: 'Operations briefing',
      subtitle: 'Keep the floor moving with scans, alerts, and fast triage.',
      focusArea: normalizedFocusArea ?? 'GENERAL',
      actions: const [
        _FieldOpsAction(
          label: 'Scan QR',
          icon: Icons.qr_code_scanner_rounded,
          route: '/operations/scan',
        ),
        _FieldOpsAction(
          label: 'Work orders',
          icon: Icons.assignment_outlined,
          route: '/work-orders',
        ),
        _FieldOpsAction(
          label: 'AI copilot',
          icon: Icons.auto_awesome_rounded,
          route: '/ai',
        ),
      ],
    );
  }
}

class _FieldOpsAction {
  const _FieldOpsAction({
    required this.label,
    required this.icon,
    required this.route,
  });

  final String label;
  final IconData icon;
  final String route;
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(color: color),
          ),
        ],
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Ink(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: onTap == null ? 0.04 : 0.08),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: AppColors.textPrimary),
            const SizedBox(width: 6),
            Text(label, style: AppTextStyles.caption),
          ],
        ),
      ),
    );
  }
}

class _InsightTile extends StatelessWidget {
  const _InsightTile({required this.insight});

  final FieldInsight insight;

  @override
  Widget build(BuildContext context) {
    final color = switch (insight.severity) {
      FieldInsightSeverity.critical => AppColors.error,
      FieldInsightSeverity.warning => AppColors.warning,
      FieldInsightSeverity.info => AppColors.info,
    };

    final icon = switch (insight.category) {
      FieldInsightCategory.maintenance => Icons.build_circle_outlined,
      FieldInsightCategory.fleet => Icons.local_shipping_outlined,
      FieldInsightCategory.utilities => Icons.bolt_outlined,
      FieldInsightCategory.inventory => Icons.inventory_2_outlined,
      FieldInsightCategory.unknown => Icons.insights_outlined,
    };

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: insight.hasRoute ? () => context.push(insight.route!) : null,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: color.withValues(alpha: 0.24)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(insight.title, style: AppTextStyles.body),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(insight.message, style: AppTextStyles.bodySecondary),
                    if (insight.suggestedAction != null &&
                        insight.suggestedAction!.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        insight.suggestedAction!,
                        style: AppTextStyles.caption.copyWith(color: color),
                      ),
                    ],
                  ],
                ),
              ),
              if (insight.hasRoute)
                const Padding(
                  padding: EdgeInsets.only(left: AppSpacing.xs),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}