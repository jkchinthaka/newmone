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
import '../data/models/cleaning_location.dart';
import 'providers/cleaning_provider.dart';

class CleaningLocationsScreen extends ConsumerWidget {
  const CleaningLocationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(cleaningLocationsProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Cleaning locations'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(cleaningLocationsProvider);
              await ref.read(cleaningLocationsProvider.future);
            },
            child: async.when(
              loading: () => ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: 6,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (_, __) => const CardShimmer(height: 96),
              ),
              error: (e, _) => AppErrorWidget(
                message: e.toString(),
                onRetry: () => ref.invalidate(cleaningLocationsProvider),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return ListView(
                    children: const [
                      SizedBox(height: 80),
                      EmptyStateWidget(
                        icon: Icons.cleaning_services_outlined,
                        title: 'No locations yet',
                        message:
                            'Cleaning locations will appear here once configured.',
                      ),
                    ],
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  itemCount: items.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (_, i) => _LocationTile(items[i]),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _LocationTile extends StatelessWidget {
  const _LocationTile(this.location);
  final CleaningLocation location;

  @override
  Widget build(BuildContext context) {
    final compliance = (location.complianceToday * 100).clamp(0, 100).round();
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withOpacity(0.7),
          child: InkWell(
            onTap: () => context.push('/cleaning/locations/${location.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          location.name,
                          style: AppTextStyles.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      _CompliancePill(compliance),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    [
                      location.area,
                      if (location.building != null) location.building,
                      if (location.floor != null) 'Floor ${location.floor}',
                    ].whereType<String>().join(' · '),
                    style: AppTextStyles.bodySecondary,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      _Chip(
                        icon: Icons.check_circle_outline_rounded,
                        label: '${location.todayVisitCount} done',
                        color: AppColors.success,
                      ),
                      if (location.pendingToday > 0)
                        _Chip(
                          icon: Icons.schedule_rounded,
                          label: '${location.pendingToday} pending',
                          color: AppColors.warning,
                        ),
                      if (location.openIssuesCount > 0)
                        _Chip(
                          icon: Icons.report_gmailerrorred_outlined,
                          label:
                              '${location.openIssuesCount} issue${location.openIssuesCount == 1 ? '' : 's'}',
                          color: AppColors.error,
                        ),
                      if (location.assignedCleanerName != null &&
                          location.assignedCleanerName!.isNotEmpty)
                        _Chip(
                          icon: Icons.person_outline,
                          label: location.assignedCleanerName!,
                          color: AppColors.info,
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CompliancePill extends StatelessWidget {
  const _CompliancePill(this.percent);
  final int percent;

  @override
  Widget build(BuildContext context) {
    final color = percent >= 90
        ? AppColors.success
        : percent >= 60
            ? AppColors.warning
            : AppColors.error;
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Text(
        '$percent%',
        style: AppTextStyles.label.copyWith(color: color),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(label, style: AppTextStyles.label.copyWith(color: color)),
        ],
      ),
    );
  }
}
