import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facilities_models.dart';

class FacilityIssueDetailScreen extends ConsumerStatefulWidget {
  const FacilityIssueDetailScreen({super.key, required this.issueId});

  final String issueId;

  @override
  ConsumerState<FacilityIssueDetailScreen> createState() =>
      _FacilityIssueDetailScreenState();
}

class _FacilityIssueDetailScreenState
    extends ConsumerState<FacilityIssueDetailScreen> {
  bool _loading = true;
  String? _error;
  FacilityIssueSummary? _issue;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final issue = await ref
          .read(facilitiesApiClientProvider)
          .getIssue(widget.issueId);
      if (!mounted) return;
      setState(() {
        _issue = issue;
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

  @override
  Widget build(BuildContext context) {
    final issue = _issue;
    return Scaffold(
      appBar: AppBar(title: Text(issue?.title ?? 'Issue')),
      body: _loading
          ? const MpLoading(message: 'Loading issue…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : issue == null
                  ? const MpEmptyState(title: 'Issue not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        Wrap(
                          spacing: MpSpacing.sm,
                          children: [
                            MpStatusChip(label: issue.status),
                            MpStatusChip(label: issue.severity),
                          ],
                        ),
                        const SizedBox(height: MpSpacing.md),
                        if (issue.description != null)
                          Text(issue.description!),
                        if (issue.workOrderId != null) ...[
                          const SizedBox(height: MpSpacing.lg),
                          MpButton(
                            label: 'Open linked work order',
                            icon: Icons.handyman_outlined,
                            onPressed: () => context.push(
                              '/work-orders/${issue.workOrderId}',
                            ),
                          ),
                        ],
                      ],
                    ),
    );
  }
}
