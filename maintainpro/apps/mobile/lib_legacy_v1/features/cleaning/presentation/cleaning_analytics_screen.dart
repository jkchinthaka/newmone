import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/dio_client.dart';

/// Pulls `/api/cleaning/analytics` and renders KPI cards + per-cleaner stats.
final _cleaningAnalyticsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<dynamic>(
    ApiEndpoints.cleaningAnalytics,
    options: Options(
      validateStatus: (s) => s != null && s < 500,
    ),
  );
  final body = res.data;
  if (body is Map<String, dynamic>) {
    final inner = body['data'];
    if (inner is Map<String, dynamic>) return inner;
    return body;
  }
  return <String, dynamic>{};
});

class CleaningAnalyticsScreen extends ConsumerWidget {
  const CleaningAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_cleaningAnalyticsProvider);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Cleaning analytics'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(_cleaningAnalyticsProvider),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _ErrorBlock(
              message: e.toString(),
              onRetry: () => ref.invalidate(_cleaningAnalyticsProvider),
            ),
            data: _AnalyticsBody.new,
          ),
        ),
      ),
    );
  }
}

class _AnalyticsBody extends StatelessWidget {
  const _AnalyticsBody(this.data);
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final summary = data['summary'] is Map<String, dynamic>
        ? data['summary'] as Map<String, dynamic>
        : data;
    final cleanerStats = (data['cleanerStats'] as List?) ?? const [];
    final trend = (data['trend'] as List?) ?? const [];

    int asInt(dynamic v) => (v is num) ? v.toInt() : int.tryParse('$v') ?? 0;
    double asDouble(dynamic v) =>
        (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;

    final totalVisits = asInt(summary['totalVisits'] ?? summary['total']);
    final approved = asInt(summary['approvedVisits'] ?? summary['approved']);
    final rejected = asInt(summary['rejectedVisits'] ?? summary['rejected']);
    final pending = asInt(summary['pendingSignOff'] ?? summary['pending']);
    final avgDuration = asDouble(
        summary['averageDurationSeconds'] ?? summary['avgDurationSeconds']);
    final avgQuality =
        asDouble(summary['averageQuality'] ?? summary['avgQuality']);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        const Text('Overview', style: AppTextStyles.title),
        const SizedBox(height: AppSpacing.sm),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.sm,
          crossAxisSpacing: AppSpacing.sm,
          childAspectRatio: 1.4,
          children: [
            _KpiCard(
                label: 'Total visits',
                value: '$totalVisits',
                icon: Icons.fact_check_outlined,
                color: AppColors.info),
            _KpiCard(
                label: 'Approved',
                value: '$approved',
                icon: Icons.verified_outlined,
                color: AppColors.success),
            _KpiCard(
                label: 'Rejected',
                value: '$rejected',
                icon: Icons.cancel_outlined,
                color: AppColors.error),
            _KpiCard(
                label: 'Pending sign-off',
                value: '$pending',
                icon: Icons.hourglass_top_rounded,
                color: AppColors.warning),
            _KpiCard(
                label: 'Avg duration',
                value: _formatDuration(avgDuration),
                icon: Icons.timer_outlined,
                color: AppColors.secondary),
            _KpiCard(
                label: 'Avg quality',
                value: avgQuality > 0 ? avgQuality.toStringAsFixed(1) : '—',
                icon: Icons.star_outline_rounded,
                color: AppColors.primaryLight),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        const Text('Top cleaners', style: AppTextStyles.title),
        const SizedBox(height: AppSpacing.sm),
        if (cleanerStats.isEmpty)
          const _EmptyHint(text: 'No cleaner activity in selected range.')
        else
          ...cleanerStats.whereType<Map>().map((raw) {
            final m = Map<String, dynamic>.from(raw);
            return _CleanerStatTile(
              name: (m['cleanerName'] ?? m['name'] ?? '—').toString(),
              total: asInt(m['totalVisits']),
              approved: asInt(m['approvedVisits']),
              rejected: asInt(m['rejectedVisits']),
              avgDuration: asDouble(m['averageDurationSeconds']),
              avgQuality: asDouble(m['averageQuality']),
            );
          }),
        const SizedBox(height: AppSpacing.lg),
        if (trend.isNotEmpty) ...[
          const Text('Daily trend', style: AppTextStyles.title),
          const SizedBox(height: AppSpacing.sm),
          ...trend.whereType<Map>().take(14).map((raw) {
            final m = Map<String, dynamic>.from(raw);
            return _TrendRow(
              date: (m['date'] ?? '').toString(),
              completed: asInt(m['completed']),
              rejected: asInt(m['rejected']),
            );
          }),
        ],
      ],
    );
  }

  static String _formatDuration(double seconds) {
    if (seconds <= 0) return '—';
    final mins = (seconds / 60).round();
    if (mins < 60) return '${mins}m';
    final h = mins ~/ 60;
    final m = mins % 60;
    return '${h}h ${m}m';
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const Spacer(),
          Text(value, style: AppTextStyles.title.copyWith(color: Colors.white)),
          Text(label,
              style: AppTextStyles.label
                  .copyWith(color: Colors.white.withValues(alpha: 0.7))),
        ],
      ),
    );
  }
}

class _CleanerStatTile extends StatelessWidget {
  const _CleanerStatTile({
    required this.name,
    required this.total,
    required this.approved,
    required this.rejected,
    required this.avgDuration,
    required this.avgQuality,
  });

  final String name;
  final int total;
  final int approved;
  final int rejected;
  final double avgDuration;
  final double avgQuality;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.person_outline, color: AppColors.primaryLight),
              const SizedBox(width: 8),
              Expanded(
                child: Text(name,
                    style:
                        AppTextStyles.subtitle.copyWith(color: Colors.white)),
              ),
              Text('$total',
                  style: AppTextStyles.title.copyWith(color: Colors.white)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _Pill(text: '✓ $approved', color: AppColors.success),
              const SizedBox(width: 6),
              _Pill(text: '✗ $rejected', color: AppColors.error),
              const SizedBox(width: 6),
              if (avgDuration > 0)
                _Pill(
                    text: _AnalyticsBody._formatDuration(avgDuration),
                    color: AppColors.secondary),
              const SizedBox(width: 6),
              if (avgQuality > 0)
                _Pill(
                    text: '★ ${avgQuality.toStringAsFixed(1)}',
                    color: AppColors.warning),
            ],
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child:
          Text(text, style: AppTextStyles.label.copyWith(color: Colors.white)),
    );
  }
}

class _TrendRow extends StatelessWidget {
  const _TrendRow({
    required this.date,
    required this.completed,
    required this.rejected,
  });

  final String date;
  final int completed;
  final int rejected;

  @override
  Widget build(BuildContext context) {
    final total = completed + rejected;
    final ratio = total == 0 ? 0.0 : completed / total;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 80,
            child: Text(date.substring(0, date.length.clamp(0, 10)),
                style: AppTextStyles.label.copyWith(color: Colors.white)),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 8,
                backgroundColor: AppColors.error.withValues(alpha: 0.4),
                valueColor:
                    const AlwaysStoppedAnimation<Color>(AppColors.success),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text('$completed/$total',
              style: AppTextStyles.label.copyWith(color: Colors.white)),
        ],
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Text(text,
            style: AppTextStyles.body.copyWith(color: Colors.white70)),
      );
}

class _ErrorBlock extends StatelessWidget {
  const _ErrorBlock({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: AppSpacing.sm),
            Text(message,
                textAlign: TextAlign.center,
                style: AppTextStyles.body.copyWith(color: Colors.white)),
            const SizedBox(height: AppSpacing.md),
            FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
