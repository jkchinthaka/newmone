import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class WarehousesScreen extends ConsumerStatefulWidget {
  const WarehousesScreen({super.key});

  @override
  ConsumerState<WarehousesScreen> createState() => _WarehousesScreenState();
}

class _WarehousesScreenState extends ConsumerState<WarehousesScreen> {
  bool _loading = true;
  String? _error;
  List<WarehouseSummary> _items = const [];

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
      final items = await ref.read(inventoryApiClientProvider).listWarehouses();
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
      appBar: AppBar(title: const Text('Warehouses')),
      body: _loading
          ? const MpLoading(message: 'Loading warehouses…')
          : _error != null
              ? MpErrorState(
                  title: 'Could not load',
                  message: _error,
                  onRetry: _load,
                )
              : _items.isEmpty
                  ? const MpEmptyState(
                      title: 'No warehouses',
                      icon: Icons.warehouse_outlined,
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final w = _items[index];
                          return MpCard(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.warehouse_outlined),
                              title: Text(w.name),
                              subtitle: Text(w.code),
                              trailing: w.isDefault
                                  ? const MpStatusChip(label: 'Default')
                                  : null,
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
