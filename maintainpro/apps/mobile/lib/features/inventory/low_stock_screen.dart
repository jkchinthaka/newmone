import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class LowStockScreen extends ConsumerStatefulWidget {
  const LowStockScreen({super.key});

  @override
  ConsumerState<LowStockScreen> createState() => _LowStockScreenState();
}

class _LowStockScreenState extends ConsumerState<LowStockScreen> {
  bool _loading = true;
  String? _error;
  List<InventoryPartSummary> _items = const [];

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
      final items = await ref.read(inventoryApiClientProvider).lowStock();
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
      appBar: AppBar(title: const Text('Low stock')),
      body: _loading
          ? const MpLoading(message: 'Loading low stock…')
          : _error != null
              ? MpErrorState(
                  title: 'Could not load',
                  message: _error,
                  onRetry: _load,
                )
              : _items.isEmpty
                  ? const MpEmptyState(
                      title: 'No low-stock parts',
                      icon: Icons.check_circle_outline,
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final p = _items[index];
                          return MpCard(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(p.name),
                              subtitle: Text(
                                '${p.partNumber} · available ${p.displayAvailable}',
                              ),
                              trailing: MpStatusChip(
                                label: p.isOutOfStock ? 'Out' : 'Low',
                                tone: p.isOutOfStock
                                    ? MpStatusTone.error
                                    : MpStatusTone.warning,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
