import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class PartRequestsListScreen extends ConsumerStatefulWidget {
  const PartRequestsListScreen({super.key});

  @override
  ConsumerState<PartRequestsListScreen> createState() =>
      _PartRequestsListScreenState();
}

class _PartRequestsListScreenState extends ConsumerState<PartRequestsListScreen> {
  bool _loading = true;
  String? _error;
  List<PartRequestSummary> _items = const [];

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
      final items = await ref.read(inventoryApiClientProvider).listPartRequests();
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
      appBar: AppBar(title: const Text('Part requests')),
      body: _loading
          ? const MpLoading(message: 'Loading requests…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No part requests')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final pr = _items[index];
                          return MpCard(
                            onTap: pr.workOrderId == null
                                ? null
                                : () => context.push(
                                      '/work-orders/${pr.workOrderId}',
                                    ),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(pr.partName ?? pr.partNumber ?? 'Part'),
                              subtitle: Text(
                                '${pr.status} · qty ${pr.requestedQuantity}'
                                '${pr.workOrderNumber != null ? ' · ${pr.workOrderNumber}' : ''}',
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
