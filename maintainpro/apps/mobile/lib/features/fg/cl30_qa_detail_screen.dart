import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/connectivity_provider.dart';
import '../../design_system/design_system.dart';
import '../work_orders/data/work_orders_repository.dart';
import 'data/fg_api_client.dart';
import 'data/fg_models.dart';

class Cl30QaDetailScreen extends ConsumerStatefulWidget {
  const Cl30QaDetailScreen({super.key, required this.submissionId});

  final String submissionId;

  @override
  ConsumerState<Cl30QaDetailScreen> createState() => _Cl30QaDetailScreenState();
}

class _Cl30QaDetailScreenState extends ConsumerState<Cl30QaDetailScreen> {
  final _noteController = TextEditingController();
  final _guard = InFlightGuard();
  FgQaDetail? _detail;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail =
          await ref.read(fgApiClientProvider).getQa(widget.submissionId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _decide(String decision) async {
    if (!ref.read(isOnlineProvider)) {
      setState(() => _error = 'Decision requires a network connection.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final outcome = await _guard.run(() async {
        // Server idempotencyKey for QA decision.
        final key = const Uuid().v4();
        return ref.read(fgApiClientProvider).qaDecision(
              submissionId: widget.submissionId,
              decision: decision,
              reviewNote: _noteController.text.trim().isEmpty
                  ? null
                  : _noteController.text.trim(),
              idempotencyKey: key,
            );
      });
      if (!mounted) return;
      if (outcome == null) {
        setState(() {
          _busy = false;
          _error = 'Decision already in progress.';
        });
        return;
      }
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Recorded $decision')),
      );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('QA disposition')),
      body: _loading
          ? const MpLoading(message: 'Loading…')
          : _error != null && _detail == null
              ? MpErrorState(
                  title: 'Could not load QA item',
                  message: _error,
                  onRetry: _load,
                )
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final d = _detail!;
    return ListView(
      padding: const EdgeInsets.all(MpSpacing.screenPadding),
      children: [
        if (_error != null) ...[
          MpCard(
            color: Theme.of(context).colorScheme.errorContainer,
            child: Text(_error!),
          ),
          const SizedBox(height: MpSpacing.md),
        ],
        Text(
          d.submission.formTitle ?? d.submission.formCode ?? 'Submission',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        if (d.existingDecision != null) ...[
          const SizedBox(height: MpSpacing.sm),
          MpStatusChip(label: d.existingDecision!, tone: MpStatusTone.info),
        ],
        const MpSectionHeader(title: 'Snapshot'),
        ...d.snapshot.map((section) {
          return Padding(
            padding: const EdgeInsets.only(bottom: MpSpacing.sm),
            child: MpCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (section['title'] ?? 'Section').toString(),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  ...asMapList(section['items']).map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(top: MpSpacing.xs),
                      child: Text(
                        '${item['label'] ?? item['code']}: ${item['value'] ?? ''}',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
        if (d.canDecide) ...[
          const MpSectionHeader(title: 'Disposition'),
          MpTextField(
            controller: _noteController,
            label: 'Review note',
            maxLines: 3,
          ),
          const SizedBox(height: MpSpacing.md),
          MpButton(
            label: 'Release',
            icon: Icons.verified,
            isLoading: _busy,
            onPressed: _busy ? null : () => _decide('RELEASE'),
          ),
          const SizedBox(height: MpSpacing.sm),
          MpButton(
            label: 'Hold',
            icon: Icons.pause_circle_outline,
            variant: MpButtonVariant.outlined,
            isLoading: _busy,
            onPressed: _busy ? null : () => _decide('HOLD'),
          ),
          const SizedBox(height: MpSpacing.sm),
          MpButton(
            label: 'Reject',
            icon: Icons.block,
            variant: MpButtonVariant.tonal,
            isLoading: _busy,
            onPressed: _busy ? null : () => _decide('REJECT'),
          ),
        ],
      ],
    );
  }
}
