import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/maintenance_provider.dart';

class PredictiveAlertsScreen extends ConsumerWidget {
  const PredictiveAlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(maintenancePredictiveAlertsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Predictive alerts')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(maintenancePredictiveAlertsProvider),
          child: alerts.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Text('Failed: $e',
                  style: AppTextStyles.body.copyWith(color: AppColors.error)),
            ),
            data: (list) {
              if (list.isEmpty) {
                return ListView(children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No predictive alerts')),
                ]);
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.xs),
                itemBuilder: (_, i) {
                  final a = list[i];
                  final color = _riskColor(a.riskLevel);
                  return Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: color.withOpacity(0.4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(Icons.psychology_outlined, color: color),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                              child:
                                  Text(a.type, style: AppTextStyles.subtitle)),
                          Text(a.riskLevel,
                              style:
                                  AppTextStyles.label.copyWith(color: color)),
                        ]),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(a.message, style: AppTextStyles.body),
                        const SizedBox(height: AppSpacing.xs),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            icon: const Icon(Icons.check),
                            label: const Text('Acknowledge'),
                            onPressed: () async {
                              try {
                                await ref
                                    .read(maintenanceRemoteProvider)
                                    .acknowledgePredictiveAlert(a.id);
                                ref.invalidate(
                                    maintenancePredictiveAlertsProvider);
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Failed: $e')),
                                  );
                                }
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }
}

Color _riskColor(String r) {
  switch (r.toUpperCase()) {
    case 'CRITICAL':
      return AppColors.error;
    case 'HIGH':
      return AppColors.error;
    case 'MEDIUM':
      return AppColors.warning;
    case 'LOW':
      return AppColors.info;
    default:
      return AppColors.info;
  }
}
