import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/i18n/app_strings.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/outbox_service.dart';
import '../../design_system/design_system.dart';
import 'compliance_permissions.dart';
import 'data/compliance_api_client.dart';

const _severities = ['MINOR', 'MODERATE', 'MAJOR', 'FATAL'];

class AccidentReportScreen extends ConsumerStatefulWidget {
  const AccidentReportScreen({super.key, this.vehicleId, this.draftId});

  final String? vehicleId;
  final String? draftId;

  static const draftEntityType = 'AccidentReportDraft';

  @override
  ConsumerState<AccidentReportScreen> createState() =>
      _AccidentReportScreenState();
}

class _AccidentReportScreenState extends ConsumerState<AccidentReportScreen> {
  final _vehicleIdController = TextEditingController();
  final _locationController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _severity = 'MINOR';
  bool _submitting = false;
  String? _error;
  String? _draftId;

  @override
  void initState() {
    super.initState();
    _draftId = widget.draftId;
    if (widget.vehicleId != null) {
      _vehicleIdController.text = widget.vehicleId!;
    }
  }

  @override
  void dispose() {
    _vehicleIdController.dispose();
    _locationController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Map<String, dynamic> _body() => {
        'vehicleId': _vehicleIdController.text.trim(),
        'location': _locationController.text.trim(),
        'description': _descriptionController.text.trim(),
        'severity': _severity,
        'occurredAt': DateTime.now().toUtc().toIso8601String(),
      };

  Future<void> _saveDraft() async {
    final auth = ref.read(authControllerProvider);
    final tenantId = auth.user?.tenantId;
    final userId = auth.user?.id;
    if (tenantId == null || userId == null) return;
    _draftId ??= DateTime.now().millisecondsSinceEpoch.toString();
    await ref.read(outboxServiceProvider).saveDraft(
          tenantId: tenantId,
          userId: userId,
          entityType: AccidentReportScreen.draftEntityType,
          draftId: _draftId,
          title: 'Accident draft',
          payload: _body(),
        );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text(AppStrings.draftSavedOnDevice)),
    );
  }

  Future<void> _submit() async {
    if (_vehicleIdController.text.trim().isEmpty) {
      setState(() => _error = 'Vehicle ID is required');
      return;
    }
    if (_locationController.text.trim().length < 3) {
      setState(() => _error = 'Location is required');
      return;
    }
    if (_descriptionController.text.trim().length < 3) {
      setState(() => _error = 'Description is required');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final created =
          await ref.read(complianceApiClientProvider).reportAccident(_body());
      if (_draftId != null) {
        await ref.read(outboxServiceProvider).deleteDraft(_draftId!);
      }
      if (!mounted) return;
      context.go('/compliance/accidents/${created.id}');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (!CompliancePermissions.canReportAccident(
      user?.permissions ?? const [],
      user?.role ?? '',
    )) {
      return Scaffold(
        appBar: AppBar(title: const Text('Report accident')),
        body: const MpErrorState(
          title: 'Not permitted',
          message: 'Your role needs accidents.report to submit reports.',
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Report accident')),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          MpTextField(
            controller: _vehicleIdController,
            label: 'Vehicle ID',
            hint: 'Authoritative vehicle record ID',
          ),
          const SizedBox(height: MpSpacing.md),
          MpTextField(
            controller: _locationController,
            label: 'Location',
            hint: 'Where it occurred',
          ),
          const SizedBox(height: MpSpacing.md),
          MpTextField(
            controller: _descriptionController,
            label: 'Description',
            maxLines: 4,
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
          if (_error != null) ...[
            const SizedBox(height: MpSpacing.md),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: MpSpacing.lg),
          const MpCard(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.info_outline),
              title: Text('Online submit only'),
              subtitle: Text(
                'Accident reports submit immediately when online. Local drafts are not auto-synced.',
              ),
            ),
          ),
          const SizedBox(height: MpSpacing.lg),
          MpButton(
            label: _submitting ? 'Submitting…' : 'Submit report',
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
