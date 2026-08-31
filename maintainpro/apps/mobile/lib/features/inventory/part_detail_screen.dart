import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class PartDetailScreen extends ConsumerStatefulWidget {
  const PartDetailScreen({super.key, required this.partId});

  final String partId;

  @override
  ConsumerState<PartDetailScreen> createState() => _PartDetailScreenState();
}

class _PartDetailScreenState extends ConsumerState<PartDetailScreen> {
  bool _loading = true;
  String? _error;
  InventoryPartSummary? _part;
  List<StockMovementSummary> _movements = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  bool get _offline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _load() async {
    if (_offline && _part == null) {
      setState(() {
        _loading = false;
        _error = 'Part detail requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(inventoryApiClientProvider);
      final part = await client.getPart(widget.partId);
      List<StockMovementSummary> movements = const [];
      try {
        movements = await client.partMovements(widget.partId);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _part = part;
        _movements = movements;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final part = _part;
    return Scaffold(
      appBar: AppBar(
        title: Text(part?.partNumber ?? 'Part'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const MpLoading(message: 'Loading part…')
          : _error != null && part == null
              ? MpErrorState(
                  title: 'Part unavailable',
                  message: _error,
                  onRetry: _load,
                )
              : part == null
                  ? const MpEmptyState(title: 'Part not found')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        children: [
                          Text(
                            part.name,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: MpSpacing.sm),
                          Wrap(
                            spacing: MpSpacing.sm,
                            runSpacing: MpSpacing.sm,
                            children: [
                              MpStatusChip(label: part.category),
                              if (part.isOutOfStock)
                                const MpStatusChip(
                                  label: 'Out of stock',
                                  tone: MpStatusTone.error,
                                )
                              else if (part.isLowStock)
                                const MpStatusChip(
                                  label: 'Low stock',
                                  tone: MpStatusTone.warning,
                                ),
                            ],
                          ),
                          const SizedBox(height: MpSpacing.lg),
                          const MpSectionHeader(title: 'Stock (server)'),
                          MpCard(
                            child: Column(
                              children: [
                                _kv('Available', '${part.displayAvailable}'),
                                _kv('On hand', '${part.quantityInStock}'),
                                if (part.reservedQuantity != null)
                                  _kv('Reserved', '${part.reservedQuantity}'),
                                _kv('Minimum', '${part.minimumStock}'),
                                _kv('Reorder point', '${part.reorderPoint}'),
                                _kv('Unit cost', '${part.unitCost}'),
                                if (part.location != null)
                                  _kv('Location', part.location!),
                                if (part.supplierName != null)
                                  _kv('Supplier', part.supplierName!),
                              ],
                            ),
                          ),
                          if (_movements.isNotEmpty) ...[
                            const SizedBox(height: MpSpacing.lg),
                            const MpSectionHeader(title: 'Recent movements'),
                            MpCard(
                              padding: EdgeInsets.zero,
                              child: Column(
                                children: [
                                  for (var i = 0; i < _movements.length; i++) ...[
                                    ListTile(
                                      title: Text(_movements[i].type),
                                      subtitle: Text(
                                        '${_movements[i].quantity} · ${_movements[i].createdAt?.toIso8601String().split('T').first ?? ''}',
                                      ),
                                    ),
                                    if (i < _movements.length - 1)
                                      const Divider(height: 1),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
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
