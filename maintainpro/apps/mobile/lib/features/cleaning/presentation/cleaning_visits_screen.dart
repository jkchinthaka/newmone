import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart';
import '../../../core/widgets/loading_shimmer.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/models/cleaning_visit.dart';
import 'providers/cleaning_provider.dart';

class CleaningVisitsScreen extends ConsumerWidget {
  const CleaningVisitsScreen({super.key, this.initialStatus});
  final String? initialStatus;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // One-shot: apply initialStatus to filters on first build.
    ref.listen(cleaningVisitsFiltersProvider, (_, __) {});
    if (initialStatus != null) {
      Future.microtask(() {
        final cur = ref.read(cleaningVisitsFiltersProvider);
        if (cur.status != initialStatus) {
          ref.read(cleaningVisitsFiltersProvider.notifier).state =
              cur.copyWith(status: initialStatus);
        }
      });
    }

    final state = ref.watch(cleaningVisitsProvider);
    final filters = ref.watch(cleaningVisitsFiltersProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Cleaning visits'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              _FiltersBar(filters: filters),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () =>
                      ref.read(cleaningVisitsProvider.notifier).refresh(),
                  child: _buildBody(context, ref, state),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(
      BuildContext context, WidgetRef ref, CleaningVisitsListState s) {
    if (s.loading && s.items.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: 6,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (_, __) => const CardShimmer(height: 88),
      );
    }
    if (s.error != null && s.items.isEmpty) {
      return AppErrorWidget(
        message: s.error!,
        onRetry: () => ref.read(cleaningVisitsProvider.notifier).refresh(),
      );
    }
    if (s.items.isEmpty) {
      return ListView(children: const [
        SizedBox(height: 80),
        EmptyStateWidget(
          icon: Icons.fact_check_outlined,
          title: 'No visits yet',
          message: 'Cleaning visits will appear here once recorded.',
        ),
      ]);
    }
    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.md),
      itemCount: s.items.length,
      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (_, i) => _VisitTile(s.items[i]),
    );
  }
}

class _FiltersBar extends ConsumerWidget {
  const _FiltersBar({required this.filters});
  final CleaningVisitFilters filters;

  static const _statuses = <String?>[
    null,
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding:
            const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 8),
        children: [
          for (final s in _statuses) ...[
            ChoiceChip(
              label: Text(s == null ? 'All' : _label(s)),
              selected: filters.status == s,
              onSelected: (_) {
                ref.read(cleaningVisitsFiltersProvider.notifier).state =
                    filters.copyWith(status: s);
              },
            ),
            const SizedBox(width: 6),
          ],
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('Mine'),
            selected: filters.assignedToMe,
            onSelected: (v) {
              ref.read(cleaningVisitsFiltersProvider.notifier).state =
                  filters.copyWith(assignedToMe: v);
            },
          ),
        ],
      ),
    );
  }

  String _label(String s) {
    return s
        .split('_')
        .map((p) => p.isEmpty ? p : p[0] + p.substring(1).toLowerCase())
        .join(' ');
  }
}

class _VisitTile extends StatelessWidget {
  const _VisitTile(this.v);
  final CleaningVisit v;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withOpacity(0.7),
          child: InkWell(
            onTap: () => context.push('/cleaning/visits/${v.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          v.locationName.isEmpty ? 'Location' : v.locationName,
                          style: AppTextStyles.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      StatusBadge(status: v.status, compact: true),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    v.locationArea,
                    style: AppTextStyles.bodySecondary,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      const Icon(Icons.person_outline,
                          size: 14, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          v.cleanerName,
                          style: AppTextStyles.caption,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const Icon(Icons.schedule_rounded,
                          size: 14, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Text(
                        DateFormatter.relative(v.scannedAt),
                        style: AppTextStyles.caption,
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
