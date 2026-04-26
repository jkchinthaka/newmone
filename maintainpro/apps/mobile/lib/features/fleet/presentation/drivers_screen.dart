import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/driver.dart';
import 'providers/fleet_provider.dart';

class DriversScreen extends ConsumerWidget {
  const DriversScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final drivers = ref.watch(driversProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Drivers')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(driversProvider);
          },
          child: drivers.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Text('Failed to load: $e',
                    style: AppTextStyles.body.copyWith(color: AppColors.error)),
              ),
            ),
            data: (list) {
              if (list.isEmpty) {
                return ListView(
                  children: const [
                    SizedBox(height: 120),
                    Center(child: Text('No drivers yet.')),
                  ],
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (_, i) => _DriverCard(driver: list[i]),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _DriverCard extends StatelessWidget {
  const _DriverCard({required this.driver});
  final Driver driver;

  @override
  Widget build(BuildContext context) {
    final licenseColor = driver.licenseExpired
        ? AppColors.error
        : driver.licenseExpiresSoon
            ? AppColors.warning
            : AppColors.success;
    final licenseLabel = driver.licenseExpired
        ? 'Expired'
        : driver.licenseExpiresSoon
            ? 'Expires soon'
            : 'Valid';
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withOpacity(0.7),
          child: InkWell(
            onTap: () => context.push('/fleet/drivers/${driver.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(children: [
                CircleAvatar(
                  backgroundColor: AppColors.primaryDark,
                  child: Text(
                    driver.displayName.isNotEmpty
                        ? driver.displayName[0].toUpperCase()
                        : '?',
                    style: AppTextStyles.subtitle,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(driver.displayName, style: AppTextStyles.subtitle),
                      const SizedBox(height: 2),
                      Text('${driver.licenseClass} · ${driver.licenseNumber}',
                          style: AppTextStyles.caption),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.xs, vertical: 2),
                  decoration: BoxDecoration(
                    color: licenseColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(AppRadius.full),
                    border: Border.all(color: licenseColor.withOpacity(0.4)),
                  ),
                  child: Text(licenseLabel,
                      style: AppTextStyles.label.copyWith(color: licenseColor)),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
