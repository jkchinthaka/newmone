import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/widgets/bottom_sheet_widget.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart';
import '../../../core/widgets/loading_shimmer.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/models/cleaning_location.dart';
import '../data/models/facility_issue.dart';
import 'providers/cleaning_provider.dart';

class FacilityIssuesScreen extends ConsumerWidget {
  const FacilityIssuesScreen({super.key});

  static const _statuses = <String?>[
    null,
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(facilityIssuesProvider);
    final selected = ref.watch(facilityIssuesFilterProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Facility issues'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openCreateSheet(context, ref),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Report issue'),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              SizedBox(
                height: 52,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: 8,
                  ),
                  children: [
                    for (final s in _statuses) ...[
                      ChoiceChip(
                        label: Text(s == null ? 'All' : _label(s)),
                        selected: selected == s,
                        onSelected: (_) => ref
                            .read(facilityIssuesFilterProvider.notifier)
                            .state = s,
                      ),
                      const SizedBox(width: 6),
                    ],
                  ],
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(facilityIssuesProvider);
                    await ref.read(facilityIssuesProvider.future);
                  },
                  child: async.when(
                    loading: () => ListView.separated(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      itemCount: 5,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: AppSpacing.sm),
                      itemBuilder: (_, __) => const CardShimmer(height: 96),
                    ),
                    error: (e, _) => AppErrorWidget(
                      message: e.toString(),
                      onRetry: () => ref.invalidate(facilityIssuesProvider),
                    ),
                    data: (items) {
                      if (items.isEmpty) {
                        return ListView(children: const [
                          SizedBox(height: 80),
                          EmptyStateWidget(
                            icon: Icons.report_gmailerrorred_outlined,
                            title: 'No issues',
                            message:
                                'Tap "Report issue" to log a facility issue.',
                          ),
                        ]);
                      }
                      return ListView.separated(
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md, AppSpacing.md, AppSpacing.md, 96),
                        itemCount: items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (_, i) => _IssueTile(items[i]),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _label(String s) => s
      .split('_')
      .map((p) => p.isEmpty ? p : p[0] + p.substring(1).toLowerCase())
      .join(' ');

  Future<void> _openCreateSheet(BuildContext context, WidgetRef ref) async {
    await showAppBottomSheet<void>(
      context,
      title: 'Report a facility issue',
      child: const _CreateIssueForm(),
    );
  }
}

class _IssueTile extends StatelessWidget {
  const _IssueTile(this.issue);
  final FacilityIssue issue;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.card.withOpacity(0.7),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      issue.title,
                      style: AppTextStyles.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  StatusBadge(status: issue.status, compact: true),
                ],
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                issue.description,
                style: AppTextStyles.bodySecondary,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: 4,
                children: [
                  _MiniChip(
                    label: issue.severity,
                    color: _severityColor(issue.severity),
                  ),
                  if (issue.locationName != null)
                    _MiniChip(
                      label: issue.locationName!,
                      color: AppColors.info,
                    ),
                  if (issue.assignedToName != null)
                    _MiniChip(
                      label: 'To: ${issue.assignedToName}',
                      color: AppColors.secondary,
                    ),
                  if (issue.isSlaBreached)
                    const _MiniChip(
                      label: 'SLA breached',
                      color: AppColors.error,
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                DateFormatter.relative(issue.createdAt),
                style: AppTextStyles.caption,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _severityColor(String s) {
    switch (s.toUpperCase()) {
      case 'CRITICAL':
        return AppColors.error;
      case 'HIGH':
        return AppColors.priorityHigh;
      case 'MEDIUM':
        return AppColors.warning;
      case 'LOW':
      default:
        return AppColors.textSecondary;
    }
  }
}

class _MiniChip extends StatelessWidget {
  const _MiniChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(label, style: AppTextStyles.caption.copyWith(color: color)),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Create issue form (in a bottom sheet)
// ─────────────────────────────────────────────────────────────────────────
class _CreateIssueForm extends ConsumerStatefulWidget {
  const _CreateIssueForm();

  @override
  ConsumerState<_CreateIssueForm> createState() => _CreateIssueFormState();
}

class _CreateIssueFormState extends ConsumerState<_CreateIssueForm> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _slaCtrl = TextEditingController(text: '24');
  String _severity = 'MEDIUM';
  CleaningLocation? _location;
  bool _busy = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _slaCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    if (_titleCtrl.text.trim().isEmpty || _descCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title and description are required')),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(cleaningRemoteProvider).createIssue(
            title: _titleCtrl.text.trim(),
            description: _descCtrl.text.trim(),
            severity: _severity,
            locationId: _location?.id,
            slaHours: int.tryParse(_slaCtrl.text.trim()),
          );
      ref.invalidate(facilityIssuesProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Issue reported')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final locationsAsync = ref.watch(cleaningLocationsProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Title',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _descCtrl,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Description',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('Severity', style: AppTextStyles.label),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            children: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
                .map((s) => ChoiceChip(
                      label: Text(s),
                      selected: _severity == s,
                      onSelected: (_) => setState(() => _severity = s),
                    ))
                .toList(),
          ),
          const SizedBox(height: AppSpacing.sm),
          locationsAsync.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text('Could not load locations: $e',
                style: AppTextStyles.caption),
            data: (items) => DropdownButtonFormField<CleaningLocation?>(
              value: _location,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Location (optional)',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem<CleaningLocation?>(
                  value: null,
                  child: Text('— No location —'),
                ),
                ...items.map(
                  (l) => DropdownMenuItem<CleaningLocation?>(
                    value: l,
                    child: Text(
                      '${l.name} · ${l.area}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
              onChanged: (v) => setState(() => _location = v),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _slaCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'SLA (hours)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: _busy ? null : _submit,
            icon: const Icon(Icons.send_rounded),
            label: Text(_busy ? 'Submitting…' : 'Submit'),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
      ),
    );
  }
}
