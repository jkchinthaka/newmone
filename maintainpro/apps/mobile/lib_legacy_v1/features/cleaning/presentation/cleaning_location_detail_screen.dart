import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/widgets/error_widget.dart';
import '../data/models/cleaning_location.dart';
import 'providers/cleaning_provider.dart';

class CleaningLocationDetailScreen extends ConsumerWidget {
  const CleaningLocationDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(cleaningLocationDetailProvider(id));
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Location'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_rounded),
            tooltip: 'Scan',
            onPressed: () => context.push('/cleaning/scan'),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => AppErrorWidget(
              message: e.toString(),
              onRetry: () => ref.invalidate(cleaningLocationDetailProvider(id)),
            ),
            data: (loc) => _Body(loc),
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body(this.loc);
  final CleaningLocation loc;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        _GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(loc.name, style: AppTextStyles.title),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                [
                  loc.area,
                  if (loc.building != null) loc.building,
                  if (loc.floor != null) 'Floor ${loc.floor}',
                ].whereType<String>().join(' · '),
                style: AppTextStyles.bodySecondary,
              ),
              if (loc.description != null && loc.description!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(loc.description!, style: AppTextStyles.body),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        _Section(
          title: 'Today',
          children: [
            _Row(
              label: 'Visits completed',
              value: '${loc.todayVisitCount} / ${loc.expectedTodayVisits}',
            ),
            _Row(
              label: 'Pending',
              value: '${loc.pendingToday}',
            ),
            _Row(
              label: 'Compliance',
              value: '${(loc.complianceToday * 100).clamp(0, 100).round()}%',
            ),
            _Row(
              label: 'Open issues',
              value: '${loc.openIssuesCount}',
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        _Section(
          title: 'Schedule',
          children: [
            if (loc.cleaningFrequency != null)
              _Row(
                label: 'Frequency',
                value:
                    '${loc.cleaningFrequency} per ${loc.cleaningFrequencyUnit ?? 'DAY'}',
              ),
            if (loc.shiftAssignment != null)
              _Row(label: 'Shift', value: loc.shiftAssignment!),
            if (loc.shiftWindow != null)
              _Row(label: 'Window', value: loc.shiftWindow!),
            if (loc.scheduleCron != null)
              _Row(label: 'Cron', value: loc.scheduleCron!),
            if (loc.assignedCleanerName != null &&
                loc.assignedCleanerName!.isNotEmpty)
              _Row(label: 'Assigned to', value: loc.assignedCleanerName!),
          ],
        ),
        if (loc.geoLatitude != null && loc.geoLongitude != null) ...[
          const SizedBox(height: AppSpacing.sm),
          _Section(
            title: 'Geofence',
            children: [
              _Row(
                  label: 'Coordinates',
                  value:
                      '${loc.geoLatitude!.toStringAsFixed(5)}, ${loc.geoLongitude!.toStringAsFixed(5)}'),
              if (loc.geoRadiusMeters != null)
                _Row(label: 'Radius', value: '${loc.geoRadiusMeters} m'),
              _Row(
                label: 'Device check',
                value: loc.requireDeviceValidation ? 'Required' : 'Off',
              ),
              _Row(
                label: 'Photo evidence',
                value: loc.requirePhoto ? 'Required' : 'Off',
              ),
            ],
          ),
        ],
        if (loc.checklistTemplate.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          _Section(
            title: 'Checklist (${loc.checklistTemplate.length})',
            children: loc.checklistTemplate
                .map(
                  (it) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.check_box_outline_blank_rounded,
                          size: 18,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: Text(
                            it.label + (it.required ? ' *' : ''),
                            style: AppTextStyles.body,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        FilledButton.icon(
          onPressed: () => context.push('/cleaning/scan'),
          icon: const Icon(Icons.qr_code_scanner_rounded),
          label: const Text('Scan to start visit'),
        ),
      ],
    );
  }
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.card.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: child,
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTextStyles.subtitle),
          const SizedBox(height: AppSpacing.sm),
          ...children,
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(label, style: AppTextStyles.bodySecondary),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: AppTextStyles.body,
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
