import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class SuppliersListScreen extends ConsumerStatefulWidget {
  const SuppliersListScreen({super.key});

  @override
  ConsumerState<SuppliersListScreen> createState() =>
      _SuppliersListScreenState();
}

class _SuppliersListScreenState extends ConsumerState<SuppliersListScreen> {
  final _searchController = TextEditingController();
  bool _loading = true;
  String? _error;
  List<SupplierSummary> _all = const [];
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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref.read(inventoryApiClientProvider).listSuppliers();
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
    }
  }

  List<SupplierSummary> get _filtered {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return _all;
    return _all
        .where(
          (s) =>
              s.name.toLowerCase().contains(q) ||
              (s.vendorCode ?? '').toLowerCase().contains(q),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final items = _filtered;
    return Scaffold(
      appBar: AppBar(title: const Text('Suppliers')),
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
              hint: 'Name or vendor code…',
              prefixIcon: Icons.search,
              onSubmitted: (v) => setState(() => _search = v.trim()),
            ),
          ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading suppliers…')
                : _error != null
                    ? MpErrorState(
                        title: 'Could not load',
                        message: _error,
                        onRetry: _load,
                      )
                    : items.isEmpty
                        ? const MpEmptyState(
                            title: 'No suppliers',
                            icon: Icons.local_shipping_outlined,
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
                                final s = items[index];
                                return MpCard(
                                  onTap: () => context.push(
                                    '/inventory/suppliers/${s.id}',
                                  ),
                                  child: ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(s.name),
                                    subtitle: Text(s.vendorCode ?? '—'),
                                    trailing: s.blacklisted
                                        ? const MpStatusChip(
                                            label: 'Blocked',
                                            tone: MpStatusTone.error,
                                          )
                                        : const Icon(Icons.chevron_right),
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
