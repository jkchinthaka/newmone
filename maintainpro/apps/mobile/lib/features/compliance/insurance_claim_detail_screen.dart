import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/compliance_api_client.dart';
import 'data/compliance_models.dart';

class InsuranceClaimDetailScreen extends ConsumerStatefulWidget {
  const InsuranceClaimDetailScreen({super.key, required this.claimId});

  final String claimId;

  @override
  ConsumerState<InsuranceClaimDetailScreen> createState() =>
      _InsuranceClaimDetailScreenState();
}

class _InsuranceClaimDetailScreenState
    extends ConsumerState<InsuranceClaimDetailScreen> {
  bool _loading = true;
  String? _error;
  InsuranceClaimSummary? _item;

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
      final item = await ref
          .read(complianceApiClientProvider)
          .getInsuranceClaim(widget.claimId);
      if (!mounted) return;
      setState(() {
        _item = item;
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
    final item = _item;
    return Scaffold(
      appBar: AppBar(title: Text(item?.claimNumber ?? 'Claim')),
      body: _loading
          ? const MpLoading(message: 'Loading claim…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : item == null
                  ? const MpEmptyState(title: 'Claim not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        MpCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Status: ${item.status}'),
                              Text('Insurer: ${item.insurerName ?? '—'}'),
                              Text('Policy: ${item.policyNumber ?? '—'}'),
                              Text('Claim amount: ${item.claimAmount}'),
                              if (item.approvedAmount != null)
                                Text('Approved: ${item.approvedAmount}'),
                              if (item.vehicleRegistration != null)
                                Text('Vehicle: ${item.vehicleRegistration}'),
                              if (item.accidentReportNumber != null)
                                Text('Accident: ${item.accidentReportNumber}'),
                            ],
                          ),
                        ),
                        if (item.accidentId != null) ...[
                          const SizedBox(height: MpSpacing.md),
                          MpButton(
                            label: 'Open linked accident',
                            icon: Icons.car_crash_outlined,
                            onPressed: () => context
                                .push('/compliance/accidents/${item.accidentId}'),
                          ),
                        ],
                      ],
                    ),
    );
  }
}
