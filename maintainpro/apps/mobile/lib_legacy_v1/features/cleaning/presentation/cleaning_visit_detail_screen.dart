import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/widgets/error_widget.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/models/app_user.dart';
import '../data/models/cleaning_visit.dart';
import 'providers/cleaning_provider.dart';

class CleaningVisitDetailScreen extends ConsumerWidget {
  const CleaningVisitDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(cleaningVisitDetailProvider(id));
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Cleaning visit'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => AppErrorWidget(
              message: e.toString(),
              onRetry: () => ref.invalidate(cleaningVisitDetailProvider(id)),
            ),
            data: (visit) => _Body(visit: visit, screenId: id),
          ),
        ),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.visit, required this.screenId});
  final CleaningVisit visit;
  final String screenId;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  late List<_ChecklistEntry> _entries;
  final _notesCtrl = TextEditingController();
  final _signNotesCtrl = TextEditingController();
  final _rejectionCtrl = TextEditingController();
  int _rating = 5;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final v = widget.visit;
    if (v.checklist.isNotEmpty) {
      _entries = v.checklist
          .map((c) => _ChecklistEntry(
                label: c.label,
                checked: c.checked,
                noteCtrl: TextEditingController(text: c.note ?? ''),
              ))
          .toList();
    } else {
      // Pull from location.checklistTemplates if API provided them on visit.location
      _entries = [];
    }
    _notesCtrl.text = v.notes ?? '';
    _rating = v.qualityScore ?? 5;
  }

  @override
  void dispose() {
    for (final e in _entries) {
      e.noteCtrl.dispose();
    }
    _notesCtrl.dispose();
    _signNotesCtrl.dispose();
    _rejectionCtrl.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(cleaningVisitDetailProvider(widget.screenId));
    ref.invalidate(cleaningVisitsProvider);
  }

  Future<void> _submit() async {
    if (_busy) return;
    final required = _entries
        .where(
            (e) => false /* required flag not transmitted on visit checklist */)
        .toList();
    if (required.any((e) => !e.checked)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Complete required items first')),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(cleaningRemoteProvider).submitVisit(
            widget.visit.id,
            checklist: _entries
                .map((e) => VisitChecklistItem(
                      label: e.label,
                      checked: e.checked,
                      note: e.noteCtrl.text.trim().isEmpty
                          ? null
                          : e.noteCtrl.text.trim(),
                    ))
                .toList(),
            notes:
                _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Visit submitted')));
      await _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signOff(bool approve) async {
    if (_busy) return;
    if (!approve && _rejectionCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide a rejection reason')),
      );
      return;
    }
    final ok = await showConfirmDialog(
      context,
      title: approve ? 'Approve visit?' : 'Reject visit?',
      message: approve
          ? 'Sign off and mark this cleaning visit as approved.'
          : 'Reject and request a re-clean.',
      confirmLabel: approve ? 'Approve' : 'Reject',
      destructive: !approve,
    );
    if (!ok) return;
    setState(() => _busy = true);
    try {
      await ref.read(cleaningRemoteProvider).signOffVisit(
            widget.visit.id,
            approve: approve,
            notes: _signNotesCtrl.text.trim().isEmpty
                ? null
                : _signNotesCtrl.text.trim(),
            rating: approve ? _rating : null,
            rejectionReason: approve
                ? null
                : (_rejectionCtrl.text.trim().isEmpty
                    ? null
                    : _rejectionCtrl.text.trim()),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(approve ? 'Visit approved' : 'Visit rejected')),
      );
      await _refresh();
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
    final v = widget.visit;
    final user = ref.watch(currentUserProvider);
    final canSign = user != null &&
        (user.role == UserRole.supervisor ||
            user.role == UserRole.manager ||
            user.role == UserRole.admin ||
            user.role == UserRole.superAdmin);
    final isOwner = user?.id == v.cleanerId;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        _GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      v.locationName.isEmpty ? 'Location' : v.locationName,
                      style: AppTextStyles.title,
                    ),
                  ),
                  StatusBadge(status: v.status),
                ],
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(v.locationArea, style: AppTextStyles.bodySecondary),
              const SizedBox(height: AppSpacing.sm),
              _Row(label: 'Cleaner', value: v.cleanerName),
              _Row(
                label: 'Scanned',
                value: DateFormatter.dateTime(v.scannedAt),
              ),
              if (v.submittedAt != null)
                _Row(
                  label: 'Submitted',
                  value: DateFormatter.dateTime(v.submittedAt!),
                ),
              if (v.signedOffAt != null)
                _Row(
                  label: 'Signed off',
                  value:
                      '${DateFormatter.dateTime(v.signedOffAt!)} · ${v.signedOffByName ?? ''}',
                ),
              if (v.qualityScore != null)
                _Row(label: 'Rating', value: '${v.qualityScore}/5'),
              if (v.rejectionReason != null && v.rejectionReason!.isNotEmpty)
                _Row(label: 'Rejection', value: v.rejectionReason!),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (_entries.isNotEmpty)
          _GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  v.isInProgress ? 'Checklist' : 'Checklist responses',
                  style: AppTextStyles.subtitle,
                ),
                const SizedBox(height: AppSpacing.xs),
                ..._entries.map((e) => _ChecklistTile(
                      entry: e,
                      readOnly: !v.isInProgress || !isOwner,
                      onChanged: () => setState(() {}),
                    )),
              ],
            ),
          ),
        if (v.isInProgress && isOwner) ...[
          const SizedBox(height: AppSpacing.sm),
          _GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Notes', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.xs),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Add any notes about this visit',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton.icon(
                  onPressed: _busy ? null : _submit,
                  icon: const Icon(Icons.check_rounded),
                  label: Text(_busy ? 'Submitting…' : 'Submit visit'),
                ),
              ],
            ),
          ),
        ],
        if (v.isSubmitted && canSign) ...[
          const SizedBox(height: AppSpacing.sm),
          _GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Sign-off', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    const Text('Rating'),
                    const SizedBox(width: AppSpacing.sm),
                    for (var i = 1; i <= 5; i++)
                      IconButton(
                        padding: EdgeInsets.zero,
                        constraints:
                            const BoxConstraints(minWidth: 32, minHeight: 32),
                        onPressed: () => setState(() => _rating = i),
                        icon: Icon(
                          i <= _rating
                              ? Icons.star_rounded
                              : Icons.star_outline_rounded,
                          color: AppColors.warning,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _signNotesCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Sign-off notes',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _rejectionCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Rejection reason (if rejecting)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : () => _signOff(false),
                        icon: const Icon(Icons.close_rounded),
                        label: const Text('Reject'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _busy ? null : () => _signOff(true),
                        icon: const Icon(Icons.check_circle_outline_rounded),
                        label: const Text('Approve'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _ChecklistEntry {
  _ChecklistEntry({
    required this.label,
    required this.checked,
    required this.noteCtrl,
  });
  final String label;
  bool checked;
  final TextEditingController noteCtrl;
}

class _ChecklistTile extends StatelessWidget {
  const _ChecklistTile({
    required this.entry,
    required this.readOnly,
    required this.onChanged,
  });
  final _ChecklistEntry entry;
  final bool readOnly;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Checkbox(
                value: entry.checked,
                onChanged: readOnly
                    ? null
                    : (v) {
                        entry.checked = v ?? false;
                        onChanged();
                      },
              ),
              Expanded(
                child: Text(entry.label, style: AppTextStyles.body),
              ),
            ],
          ),
          if (!readOnly)
            Padding(
              padding: const EdgeInsets.only(left: 32),
              child: TextField(
                controller: entry.noteCtrl,
                decoration: const InputDecoration(
                  isDense: true,
                  hintText: 'Optional note',
                  border: OutlineInputBorder(),
                ),
              ),
            )
          else if (entry.noteCtrl.text.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 32, top: 2),
              child: Text(
                entry.noteCtrl.text,
                style: AppTextStyles.caption,
              ),
            ),
        ],
      ),
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

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
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
