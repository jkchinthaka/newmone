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
            String fmt(DateTime dt) =>
                '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.card.withOpacity(0.7),
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
              ],
            );
          },
        ),
      ),
    );
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
