import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class PurchaseOrdersListScreen extends ConsumerStatefulWidget {
  const PurchaseOrdersListScreen({super.key});

  @override
  ConsumerState<PurchaseOrdersListScreen> createState() =>
      _PurchaseOrdersListScreenState();
}

class _PurchaseOrdersListScreenState
    extends ConsumerState<PurchaseOrdersListScreen> {
  bool _loading = true;
  String? _error;
  List<PurchaseOrderSummary> _items = const [];

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
      final items =
          await ref.read(inventoryApiClientProvider).listPurchaseOrders();
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
      appBar: AppBar(title: const Text('Purchase orders')),
      body: _loading
          ? const MpLoading(message: 'Loading POs…')
          : _error != null
              ? MpErrorState(
                  title: 'Could not load',
                  message: _error,
                  onRetry: _load,
                )
              : _items.isEmpty
                  ? const MpEmptyState(
                      title: 'No purchase orders',
                      icon: Icons.receipt_long_outlined,
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final po = _items[index];
                          return MpCard(
                            onTap: () => context.push(
                              '/inventory/purchase-orders/${po.id}',
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        po.poNumber,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium,
                                      ),
                                    ),
                                    MpStatusChip(label: po.status),
                                  ],
                                ),
                                if (po.supplierName != null)
                                  Text(po.supplierName!),
                                Text(
                                  'Total ${po.totalAmount}'
                                  '${po.workflowStatus != null ? ' · ${po.workflowStatus}' : ''}',
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
