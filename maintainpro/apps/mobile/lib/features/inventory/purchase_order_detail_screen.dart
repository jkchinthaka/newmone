import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class PurchaseOrderDetailScreen extends ConsumerStatefulWidget {
  const PurchaseOrderDetailScreen({super.key, required this.purchaseOrderId});

  final String purchaseOrderId;

  @override
  ConsumerState<PurchaseOrderDetailScreen> createState() =>
      _PurchaseOrderDetailScreenState();
}

class _PurchaseOrderDetailScreenState
    extends ConsumerState<PurchaseOrderDetailScreen> {
  bool _loading = true;
  String? _error;
  PurchaseOrderDetail? _po;

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
      final po = await ref
          .read(inventoryApiClientProvider)
          .getPurchaseOrder(widget.purchaseOrderId);
      if (!mounted) return;
      setState(() {
        _po = po;
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
    final po = _po;
    return Scaffold(
      appBar: AppBar(title: Text(po?.poNumber ?? 'Purchase order')),
      body: _loading
          ? const MpLoading(message: 'Loading PO…')
          : _error != null
              ? MpErrorState(
                  title: 'PO unavailable',
                  message: _error,
                  onRetry: _load,
                )
              : po == null
                  ? const MpEmptyState(title: 'PO not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        Wrap(
                          spacing: MpSpacing.sm,
                          runSpacing: MpSpacing.sm,
                          children: [
                            MpStatusChip(label: po.status),
                            if (po.workflowStatus != null)
                              MpStatusChip(label: po.workflowStatus!),
                          ],
                        ),
                        const SizedBox(height: MpSpacing.lg),
                        MpCard(
                          child: Column(
                            children: [
                              _kv('Supplier', po.supplierName ?? '—'),
                              _kv('Total (server)', '${po.totalAmount}'),
                              if (po.requiresFinanceApproval)
                                _kv('Finance approval', 'Required'),
                            ],
                          ),
                        ),
                        if (po.approvals.isNotEmpty) ...[
                          const SizedBox(height: MpSpacing.lg),
                          const MpSectionHeader(title: 'Approvals'),
                          MpCard(
                            padding: EdgeInsets.zero,
                            child: Column(
                              children: [
                                for (var i = 0; i < po.approvals.length; i++) ...[
                                  ListTile(
                                    title: Text(po.approvals[i].stage),
                                    subtitle: Text(po.approvals[i].status),
                                  ),
                                  if (i < po.approvals.length - 1)
                                    const Divider(height: 1),
                                ],
                              ],
                            ),
                          ),
                        ],
                        if (po.lines.isNotEmpty) ...[
                          const SizedBox(height: MpSpacing.lg),
                          const MpSectionHeader(title: 'Lines'),
                          ...po.lines.map(
                            (line) => Padding(
                              padding: const EdgeInsets.only(
                                bottom: MpSpacing.sm,
                              ),
                              child: MpCard(
                                child: ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(
                                    line.partName ?? line.partNumber ?? 'Line',
                                  ),
                                  subtitle: Text(
                                    'Qty ${line.quantity} · ${line.totalCost}',
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: MpSpacing.lg),
                        const MpCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(Icons.info_outline),
                            title: Text('Receiving not on mobile'),
                            subtitle: Text(
                              'GRN modifies stock and requires receipt idempotency — use web procurement receiving.',
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MpSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(k, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
          Expanded(child: Text(v)),
        ],
      ),
    );
  }
}
