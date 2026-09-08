import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class PartsListScreen extends ConsumerStatefulWidget {
  const PartsListScreen({super.key});

  @override
  ConsumerState<PartsListScreen> createState() => _PartsListScreenState();
}

class _PartsListScreenState extends ConsumerState<PartsListScreen> {
  final _searchController = TextEditingController();
  bool _loading = true;
  String? _error;
  List<InventoryPartSummary> _all = const [];
  String _search = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool get _offline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _load() async {
    if (_offline && _all.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Parts list requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref.read(inventoryApiClientProvider).listParts();
      if (!mounted) return;
      setState(() {
        _all = items;
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

  List<InventoryPartSummary> get _filtered {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return _all;
    return _all
        .where(
          (p) =>
              p.name.toLowerCase().contains(q) ||
              p.partNumber.toLowerCase().contains(q) ||
              p.category.toLowerCase().contains(q),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final items = _filtered;
    return Scaffold(
      appBar: AppBar(title: const Text('Parts')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              MpSpacing.screenPadding,
              MpSpacing.md,
              MpSpacing.screenPadding,
              MpSpacing.sm,
            ),
            child: MpTextField(
              controller: _searchController,
              label: 'Search',
              hint: 'SKU, name, category…',
              prefixIcon: Icons.search,
              onSubmitted: (v) => setState(() => _search = v.trim()),
            ),
          ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading parts…')
                : _error != null && _all.isEmpty
                    ? MpErrorState(
                        title: 'Could not load parts',
                        message: _error,
                        onRetry: _load,
                      )
                    : items.isEmpty
                        ? const MpEmptyState(
                            title: 'No parts found',
                            icon: Icons.inventory_2_outlined,
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(
                                MpSpacing.screenPadding,
                              ),
                              itemCount: items.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: MpSpacing.sm),
                              itemBuilder: (context, index) {
                                final part = items[index];
                                return MpCard(
                                  onTap: () =>
                                      context.push('/inventory/parts/${part.id}'),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              part.name,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .titleMedium,
                                            ),
                                          ),
                                          if (part.isOutOfStock)
                                            const MpStatusChip(
                                              label: 'Out',
                                              tone: MpStatusTone.error,
                                            )
                                          else if (part.isLowStock)
                                            const MpStatusChip(
                                              label: 'Low',
                                              tone: MpStatusTone.warning,
                                            ),
                                        ],
                                      ),
                                      Text(part.partNumber),
                                      const SizedBox(height: MpSpacing.xs),
                                      Text(
                                        'Available ${part.displayAvailable} · On hand ${part.quantityInStock}',
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
