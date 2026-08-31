import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/database/app_database.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/outbox_service.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facility_issue_draft.dart';
import 'facilities_permissions.dart';

const _severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const _categories = [
  'ELECTRICAL',
  'PLUMBING',
  'CIVIL',
  'HVAC',
  'SAFETY',
  'CLEANING',
  'PEST_CONTROL',
  'OTHER',
];

class FacilityIssueReportScreen extends ConsumerStatefulWidget {
  const FacilityIssueReportScreen({
    super.key,
    this.draftId,
    this.roomId,
    this.roomLabel,
  });

  final String? draftId;
  final String? roomId;
  final String? roomLabel;

  @override
  ConsumerState<FacilityIssueReportScreen> createState() =>
      _FacilityIssueReportScreenState();
}

class _FacilityIssueReportScreenState
    extends ConsumerState<FacilityIssueReportScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _severity = 'MEDIUM';
  String? _category = 'OTHER';
  String? _draftId;
  String? _roomId;
  String? _roomLabel;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _draftId = widget.draftId;
    _roomId = widget.roomId;
    _roomLabel = widget.roomLabel;
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    if (_draftId == null) return;
    final auth = ref.read(authControllerProvider);
    final tenantId = auth.user?.tenantId;
    final userId = auth.user?.id;
    if (tenantId == null || userId == null) return;
    final drafts = await ref.read(outboxServiceProvider).listDrafts(
          tenantId: tenantId,
          userId: userId,
        );
    LocalDraft? match;
    for (final d in drafts) {
      if (d.draftId == _draftId) {
        match = d;
        break;
      }
    }
    final payload = match == null ? null : FacilityIssueDraftPayload.fromDraft(match);
    if (payload == null || !mounted) return;
    setState(() {
      _titleController.text = payload.title;
      _descriptionController.text = payload.description;
      _severity = payload.severity;
      _category = payload.category ?? 'OTHER';
      _roomId = payload.roomId ?? _roomId;
      _roomLabel = payload.roomLabel ?? _roomLabel;
    });
  }

  Map<String, dynamic> _body() => {
        'title': _titleController.text.trim(),
        'description': _descriptionController.text.trim(),
        'severity': _severity,
        if (_category != null) 'category': _category,
        if (_roomId != null && _roomId!.isNotEmpty) 'roomId': _roomId,
      };

  Future<void> _saveDraft() async {
    final auth = ref.read(authControllerProvider);
    final tenantId = auth.user?.tenantId;
    final userId = auth.user?.id;
    if (tenantId == null || userId == null) return;
    _draftId ??= DateTime.now().millisecondsSinceEpoch.toString();
    final payload = FacilityIssueDraftPayload(
      title: _titleController.text.trim(),
      description: _descriptionController.text.trim(),
      severity: _severity,
      category: _category,
      roomId: _roomId,
      roomLabel: _roomLabel,
    );
    await ref.read(outboxServiceProvider).saveDraft(
          tenantId: tenantId,
          userId: userId,
          entityType: FacilityIssueDraftPayload.entityType,
          draftId: _draftId,
          title: payload.title.isEmpty ? 'Facility issue draft' : payload.title,
          payload: payload.toJson(),
        );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Draft saved locally')),
    );
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final description = _descriptionController.text.trim();
    if (title.length < 3) {
      setState(() => _error = 'Title must be at least 3 characters');
      return;
    }
    if (description.length < 3) {
      setState(() => _error = 'Description must be at least 3 characters');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final client = ref.read(facilitiesApiClientProvider);
      final dup = await client.checkDuplicateIssues(_body());
      if (dup.hasDuplicates && mounted) {
        final proceed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Possible duplicate'),
            content: Text(
              'Similar open issues exist (${dup.candidates.length}). Submit anyway?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Submit'),
              ),
            ],
          ),
        );
        if (proceed != true) {
          if (mounted) setState(() => _submitting = false);
          return;
        }
      }

      final created = await client.createIssue(_body());
      final auth = ref.read(authControllerProvider);
      if (_draftId != null &&
          auth.user?.tenantId != null &&
          auth.user?.id != null) {
        await ref.read(outboxServiceProvider).deleteDraft(_draftId!);
      }
      if (!mounted) return;
      context.go('/facilities/issues/${created.id}');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _submitting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not submit issue';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authControllerProvider).user?.role;
    if (!FacilitiesPermissions.canReportIssue(role)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Report issue')),
        body: const MpErrorState(
          title: 'Not permitted',
          message: 'Your role cannot report facility issues on mobile.',
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Report issue')),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          if (_roomLabel != null)
            Padding(
              padding: const EdgeInsets.only(bottom: MpSpacing.md),
              child: Text('Room: $_roomLabel'),
            ),
          MpTextField(
            controller: _titleController,
            label: 'Title',
            hint: 'Brief summary',
          ),
          const SizedBox(height: MpSpacing.md),
          MpTextField(
            controller: _descriptionController,
            label: 'Description',
            hint: 'What is wrong?',
            maxLines: 5,
          ),
          const SizedBox(height: MpSpacing.md),
          Text('Severity', style: Theme.of(context).textTheme.labelLarge),
          Wrap(
            spacing: MpSpacing.xs,
            children: _severities
                .map(
                  (s) => ChoiceChip(
                    label: Text(s),
                    selected: _severity == s,
                    onSelected: _submitting
                        ? null
                        : (selected) {
                            if (selected) setState(() => _severity = s);
                          },
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: MpSpacing.md),
          Text('Category', style: Theme.of(context).textTheme.labelLarge),
          Wrap(
            spacing: MpSpacing.xs,
            runSpacing: MpSpacing.xs,
            children: _categories
                .map(
                  (c) => ChoiceChip(
                    label: Text(c),
                    selected: _category == c,
                    onSelected: _submitting
                        ? null
                        : (selected) {
                            if (selected) setState(() => _category = c);
                          },
                  ),
                )
                .toList(),
          ),
          if (_error != null) ...[
            const SizedBox(height: MpSpacing.md),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: MpSpacing.lg),
          const MpCard(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.info_outline),
              title: Text('Online submit only'),
              subtitle: Text(
                'Issues are submitted immediately when online. Drafts are saved locally and are not auto-synced — no server idempotency for create.',
              ),
            ),
          ),
          const SizedBox(height: MpSpacing.lg),
          MpButton(
            label: _submitting ? 'Submitting…' : 'Submit issue',
            icon: Icons.send,
            onPressed: _submitting ? null : _submit,
          ),
          const SizedBox(height: MpSpacing.sm),
          MpButton(
            label: 'Save local draft',
            variant: MpButtonVariant.outlined,
            icon: Icons.save_outlined,
            onPressed: _submitting ? null : _saveDraft,
          ),
        ],
      ),
    );
  }
}
