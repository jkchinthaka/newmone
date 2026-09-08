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
import '../../../core/widgets/status_badge.dart';
import '../data/models/asset.dart';
import 'providers/assets_provider.dart';
import 'widgets/asset_filter_sheet.dart';

class AssetsScreen extends ConsumerWidget {
  const AssetsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(assetsListProvider);
    final filters = ref.watch(assetsFiltersProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Assets'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_rounded),
            tooltip: 'Scan asset',
            onPressed: () => context.push('/assets/scan'),
          ),
          IconButton(
            icon: Badge(
              smallSize: 8,
              isLabelVisible: !filters.isEmpty,
              child: const Icon(Icons.tune_rounded),
            ),
            tooltip: 'Filters',
            onPressed: () => showAssetFilterSheet(context, ref),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              const AssetSearchField(),
              const AssetActiveFiltersBar(),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () =>
                      ref.read(assetsListProvider.notifier).refresh(),
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
      BuildContext context, WidgetRef ref, AssetsListState state) {
    if (state.loading && state.items.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: 6,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (_, __) => const CardShimmer(height: 92),
      );
    }
    if (state.error != null && state.items.isEmpty) {
      return AppErrorWidget(
        message: state.error!,
        onRetry: () => ref.read(assetsListProvider.notifier).refresh(),
      );
    }
    if (state.items.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 80),
          EmptyStateWidget(
            icon: Icons.precision_manufacturing_outlined,
            title: 'No assets',
            message: 'Try adjusting filters or scan a QR to find an asset.',
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.huge),
      itemCount: state.items.length,
      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (_, i) => _AssetTile(asset: state.items[i]),
    );
  }
}

class _AssetTile extends StatelessWidget {
  const _AssetTile({required this.asset});
  final Asset asset;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        onTap: () => context.push('/assets/${asset.id}'),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.card.withValues(alpha: 0.85),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
              color: asset.hasOpenWorkOrders
                  ? AppColors.warning.withValues(alpha: 0.5)
                  : AppColors.border,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.precision_manufacturing_outlined,
                    color: AppColors.primaryLight, size: 22),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      asset.assetTag,
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.primaryLight,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.4,
                      ),
                    ),
                    Text(
                      asset.name,
                      style: AppTextStyles.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (asset.location != null) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          const Icon(Icons.place_outlined,
                              size: 13, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              asset.location!,
                              style: AppTextStyles.caption,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: 4,
                      children: [
                        StatusBadge(status: asset.status, compact: true),
                        _Chip(
                            label: asset.category.replaceAll('_', ' '),
                            icon: Icons.category_outlined),
                        if (asset.hasOpenWorkOrders)
                          _Chip(
                            label: '${asset.openWorkOrderCount} open WO',
                            icon: Icons.assignment_outlined,
                            color: AppColors.warning,
                          ),
                        if (asset.isServiceDue)
                          const _Chip(
                            label: 'Service due',
                            icon: Icons.build_outlined,
                            color: AppColors.error,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded,
                  color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.icon, this.color});
  final String label;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textSecondary;
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(color: c.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: c),
          const SizedBox(width: 4),
          Text(label, style: AppTextStyles.caption.copyWith(color: c)),
        ],
      ),
    );
  }
}

/// Glass blurred search input for assets.
class AssetSearchField extends ConsumerStatefulWidget {
  const AssetSearchField({super.key});

  @override
  ConsumerState<AssetSearchField> createState() => _AssetSearchFieldState();
}

class _AssetSearchFieldState extends ConsumerState<AssetSearchField> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
      text: ref.read(assetsFiltersProvider).search ?? '',
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.card.withValues(alpha: 0.6),
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: TextField(
              controller: _ctrl,
              decoration: const InputDecoration(
                border: InputBorder.none,
                hintText: 'Search assets, tags, locations…',
                prefixIcon: Icon(Icons.search_rounded),
                contentPadding: EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
              ),
              onChanged: (v) {
                ref.read(assetsFiltersProvider.notifier).update(
                      (f) => f.copyWith(search: v.trim().isEmpty ? null : v),
                    );
              },
            ),
          ),
        ),
      ),
    );
  }
}
