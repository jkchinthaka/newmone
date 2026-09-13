import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class WarehouseBalancesScreen extends ConsumerStatefulWidget {
  const WarehouseBalancesScreen({super.key});

  @override
  ConsumerState<WarehouseBalancesScreen> createState() =>
      _WarehouseBalancesScreenState();
}

class _WarehouseBalancesScreenState extends ConsumerState<WarehouseBalancesScreen> {
  bool _loading = true;
  String? _error;
  List<WarehouseBalanceSummary> _items = const [];

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
          await ref.read(inventoryApiClientProvider).listWarehouseBalances();
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
      appBar: AppBar(title: const Text('Warehouse balances')),
      body: _loading
          ? const MpLoading(message: 'Loading balances…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No warehouse balances')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final row = _items[index];
                          return MpCard(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(row.partName ?? row.partNumber ?? 'Part'),
                              subtitle: Text(
                                '${row.warehouseName ?? row.warehouseCode ?? 'WH'} · available ${row.available}',
                              ),
                              trailing: Text('On hand ${row.onHand}'),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
