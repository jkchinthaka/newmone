import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/compliance_api_client.dart';
import 'data/compliance_models.dart';

class TrafficFineDetailScreen extends ConsumerStatefulWidget {
  const TrafficFineDetailScreen({super.key, required this.fineId});

  final String fineId;

  @override
  ConsumerState<TrafficFineDetailScreen> createState() =>
      _TrafficFineDetailScreenState();
}

class _TrafficFineDetailScreenState extends ConsumerState<TrafficFineDetailScreen> {
  bool _loading = true;
  String? _error;
  TrafficFineSummary? _item;

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
      final item =
          await ref.read(complianceApiClientProvider).getTrafficFine(widget.fineId);
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
      appBar: AppBar(title: const Text('Traffic fine')),
      body: _loading
          ? const MpLoading(message: 'Loading fine…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : item == null
                  ? const MpEmptyState(title: 'Fine not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        MpCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.offense,
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              Text('Payment: ${item.paymentStatus}'),
                              Text('Amount: ${item.fineAmount}'),
                              if (item.fineDate != null)
                                Text('Date: ${item.fineDate!.toLocal()}'),
                              if (item.location != null)
                                Text('Location: ${item.location}'),
                              if (item.responsibility != null)
                                Text('Responsibility: ${item.responsibility}'),
                              if (item.vehicleRegistration != null)
                                Text('Vehicle: ${item.vehicleRegistration}'),
                            ],
                          ),
                        ),
                        if (item.vehicleId != null) ...[
                          const SizedBox(height: MpSpacing.md),
                          MpButton(
                            label: 'Open vehicle',
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
