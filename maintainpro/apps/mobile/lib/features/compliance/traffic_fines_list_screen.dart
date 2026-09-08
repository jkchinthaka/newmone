import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/compliance_api_client.dart';
import 'data/compliance_models.dart';

class TrafficFinesListScreen extends ConsumerStatefulWidget {
  const TrafficFinesListScreen({super.key, this.vehicleId});

  final String? vehicleId;

  @override
  ConsumerState<TrafficFinesListScreen> createState() =>
      _TrafficFinesListScreenState();
}

class _TrafficFinesListScreenState extends ConsumerState<TrafficFinesListScreen> {
  bool _loading = true;
  String? _error;
  List<TrafficFineSummary> _items = const [];

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
      final items = await ref
          .read(complianceApiClientProvider)
          .listTrafficFines(vehicleId: widget.vehicleId);
      if (!mounted) return;
      setState(() {
        _items = items;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Traffic fines')),
      body: _loading
          ? const MpLoading(message: 'Loading fines…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No traffic fines')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          return MpCard(
                            onTap: () =>
                                context.push('/compliance/traffic-fines/${item.id}'),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                item.offense,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                '${item.paymentStatus} · ${item.fineAmount} · ${item.vehicleRegistration ?? ''}',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
