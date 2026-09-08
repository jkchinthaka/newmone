import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/fleet_provider.dart';

class DriverDetailScreen extends ConsumerWidget {
  const DriverDetailScreen({super.key, required this.driverId});
  final String driverId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(driverDetailProvider(driverId));
    final intelligenceAsync = ref.watch(driverIntelligenceProvider(driverId));
    return Scaffold(
      appBar: AppBar(title: const Text('Driver')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text('Failed: $e',
                  style: AppTextStyles.body.copyWith(color: AppColors.error)),
            ),
          ),
          data: (d) {
            final intelligence = intelligenceAsync.valueOrNull;
            String fmt(DateTime dt) =>
                '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.card.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d.displayName, style: AppTextStyles.title),
                      const SizedBox(height: AppSpacing.xs),
                      if (d.user?.email != null)
                        Text(d.user!.email, style: AppTextStyles.bodySecondary),
                      if (d.user?.phone != null)
                        Text(d.user!.phone!,
                            style: AppTextStyles.bodySecondary),
                      const Divider(height: AppSpacing.lg),
                      _row('License #', d.licenseNumber),
                      _row('License class', d.licenseClass),
                      _row('Expires', fmt(d.licenseExpiry)),
                      _row('Available', d.isAvailable ? 'Yes' : 'No'),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (intelligenceAsync.isLoading)
                  const _InfoCard(
                    title: 'Driver intelligence',
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  )
                else if (intelligence != null) ...[
                  _InfoCard(
                    title: 'Risk and eligibility',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            _MetricChip(
                              label: 'Driver score',
                              value: intelligence.driverScore.toString(),
                              color: AppColors.info,
                            ),
                            _MetricChip(
                              label: 'Risk',
                              value: intelligence.riskLevel,
                              color: _riskColor(intelligence.riskLevel),
                            ),
                            _MetricChip(
                              label: 'Ranking',
                              value: intelligence.rankingScore.toString(),
                              color: AppColors.warning,
                            ),
                            _MetricChip(
                              label: 'Eligibility',
                              value: intelligence.eligibility.eligible
                                  ? 'Eligible'
                                  : 'Review required',
                              color: intelligence.eligibility.eligible
                                  ? AppColors.success
                                  : AppColors.error,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _row(
                          'Training status',
                          intelligence.inputs.trainingStatus,
                        ),
                        _row(
                          'Supervisor review',
                          intelligence.inputs.supervisorReviewScore
                                  ?.toStringAsFixed(0) ??
                              '—',
                        ),
                        _row(
                          'Disciplinary issues',
                          intelligence.inputs.pendingDisciplinaryIssues
                              .toString(),
                        ),
                        _row(
                          'Vehicle care score',
                          intelligence.components.vehicleCareScore
                              .toStringAsFixed(0),
                        ),
                        _row(
                          'Fuel efficiency score',
                          intelligence.components.fuelEfficiencyScore
                              .toStringAsFixed(0),
                        ),
                        if (!intelligence.eligibility.eligible) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            'Eligibility review reasons',
                            style: AppTextStyles.body.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          ...intelligence.eligibility.reasons.map(
                            (reason) => Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: AppSpacing.xxs,
                              ),
                              child: Text(
                                '• $reason',
                                style: AppTextStyles.bodySecondary,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _InfoCard(
                    title: 'Linked operational signals',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _row(
                          'Driver-fault accidents',
                          intelligence.summary.driverFaultAccidents.toString(),
                        ),
                        _row(
                          'Driver-related fines',
                          intelligence.summary.driverRelatedFines.toString(),
                        ),
                        _row(
                          'Fuel flags',
                          intelligence.summary.abnormalFuelUsageCount.toString(),
                        ),
                        _row(
                          'Trips completed',
                          '${intelligence.summary.completedTrips}/${intelligence.summary.totalTrips}',
                        ),
                        _row(
                          'Non-compliant vehicles',
                          intelligence.summary.nonCompliantAssignedVehicles
                              .toString(),
                        ),
                        if (intelligence.assignedVehicles.isNotEmpty) ...[
                          const Divider(height: AppSpacing.lg),
                          Text(
                            'Assigned vehicles',
                            style: AppTextStyles.body.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          ...intelligence.assignedVehicles.map(
                            (vehicle) => Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: AppSpacing.xxs,
                              ),
                              child: Text(
                                '${vehicle.registrationNo} · ${vehicle.vehicleModel} · ${vehicle.complianceStatus}',
                                style: AppTextStyles.bodySecondary,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ] else if (intelligenceAsync.hasError)
                  const _InfoCard(
                    title: 'Driver intelligence',
                    child: Text(
                      'Additional driver intelligence is temporarily unavailable.',
                      style: AppTextStyles.bodySecondary,
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  Color _riskColor(String riskLevel) {
    switch (riskLevel) {
      case 'LOW':
        return AppColors.success;
      case 'MEDIUM':
        return AppColors.warning;
      case 'HIGH':
      case 'CRITICAL':
        return AppColors.error;
      default:
        return AppColors.info;
    }
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(children: [
        SizedBox(width: 130, child: Text(k, style: AppTextStyles.caption)),
        Expanded(child: Text(v, style: AppTextStyles.body)),
      ]),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTextStyles.title),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: AppTextStyles.caption),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            value,
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
