import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/compliance_api_client.dart';
import 'data/compliance_models.dart';

class AccidentDetailScreen extends ConsumerStatefulWidget {
  const AccidentDetailScreen({super.key, required this.accidentId});

  final String accidentId;

  @override
  ConsumerState<AccidentDetailScreen> createState() =>
      _AccidentDetailScreenState();
}

class _AccidentDetailScreenState extends ConsumerState<AccidentDetailScreen> {
  bool _loading = true;
  String? _error;
  AccidentSummary? _item;

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
          .getAccident(widget.accidentId);
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
      appBar: AppBar(title: Text(item?.reportNumber ?? 'Accident')),
      body: _loading
          ? const MpLoading(message: 'Loading accident…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : item == null
                  ? const MpEmptyState(title: 'Accident not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        MpCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${item.severity} · ${item.status}'),
                              Text('Location: ${item.location}'),
                              if (item.occurredAt != null)
                                Text('When: ${item.occurredAt!.toLocal()}'),
                              if (item.vehicleRegistration != null)
                                Text('Vehicle: ${item.vehicleRegistration}'),
                              const SizedBox(height: MpSpacing.sm),
                              Text(item.description),
                            ],
                          ),
                        ),
                        if (item.workOrderId != null) ...[
                          const SizedBox(height: MpSpacing.md),
                          MpButton(
                            label: 'Open work order ${item.workOrderNumber ?? ''}',
                            icon: Icons.build_outlined,
                            onPressed: () =>
                                context.push('/work-orders/${item.workOrderId}'),
                          ),
                        ],
                        if (item.vehicleId != null) ...[
                          const SizedBox(height: MpSpacing.sm),
                          MpButton(
                            label: 'Open vehicle',
                            variant: MpButtonVariant.outlined,
                            icon: Icons.directions_car_outlined,
                            onPressed: () =>
                                context.push('/fleet/vehicles/${item.vehicleId}'),
                          ),
                        ],
                      ],
                    ),
    );
  }
}
