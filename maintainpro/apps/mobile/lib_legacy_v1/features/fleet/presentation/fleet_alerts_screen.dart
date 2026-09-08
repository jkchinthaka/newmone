import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/fleet_provider.dart';

class FleetAlertsScreen extends ConsumerWidget {
  const FleetAlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(fleetAlertsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Fleet alerts')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(fleetAlertsProvider),
          child: alerts.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Text('Failed: $e',
                    style: AppTextStyles.body.copyWith(color: AppColors.error)),
              ),
            ),
            data: (list) {
              if (list.isEmpty) {
                return ListView(
                  children: const [
                    SizedBox(height: 120),
                    Center(child: Text('No alerts')),
                  ],
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.xs),
                itemBuilder: (_, i) {
                  final a = list[i];
                  final color = a.severity == 'CRITICAL'
                      ? AppColors.error
                      : a.severity == 'WARNING'
                          ? AppColors.warning
                          : AppColors.info;
                  return Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: color.withValues(alpha: 0.4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(Icons.warning_amber_rounded, color: color),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Text(
                              '${a.registrationNo} · ${a.type}',
                              style: AppTextStyles.subtitle,
                            ),
                          ),
                          Text(a.severity,
                              style:
                                  AppTextStyles.label.copyWith(color: color)),
                        ]),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(a.message, style: AppTextStyles.body),
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
