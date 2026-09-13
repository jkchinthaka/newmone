import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/asset_models.dart';
import 'data/assets_api_client.dart';

const _statusFilters = <String?>[
  null,
  'ACTIVE',
  'INACTIVE',
  'UNDER_MAINTENANCE',
  'DISPOSED',
];

/// Paginated assets list — phone cards, search, status/category filters.
class AssetsListScreen extends ConsumerStatefulWidget {
  const AssetsListScreen({
    super.key,
    this.initialCategory,
    this.serviceFocus = false,
  });

  final String? initialCategory;
  final bool serviceFocus;

  @override
  ConsumerState<AssetsListScreen> createState() => _AssetsListScreenState();
}

class _AssetsListScreenState extends ConsumerState<AssetsListScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _debounce;

  List<AssetSummary> _items = [];
  int _page = 1;
  bool _hasNext = false;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String? _statusFilter;
  late String? _categoryFilter;
  bool _hasLoadedOnce = false;

  @override
  void initState() {
    super.initState();
    _categoryFilter = widget.initialCategory;
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  void _onScroll() {
    if (!_hasNext || _loadingMore || _loading) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  void _onQueryChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _refresh);
  }

  List<AssetSummary> _applyServiceFocus(List<AssetSummary> items) {
    if (!widget.serviceFocus) return items;
    final filtered = items
        .where((a) => a.isServiceOverdue || a.isServiceDueSoon)
        .toList();
    filtered.sort((a, b) {
      final ad = a.nextServiceDate ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bd = b.nextServiceDate ?? DateTime.fromMillisecondsSinceEpoch(0);
      return ad.compareTo(bd);
    });
    return filtered;
  }

  Future<void> _refresh() async {
    if (_isOffline && !_hasLoadedOnce) {
      setState(() {
        _loading = false;
        _error = 'Assets require connection (no cached list yet)';
      });
      return;
    }
    if (_isOffline && _hasLoadedOnce) {
      setState(() => _error = null);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _page = 1;
    });
    try {
      final page = await ref.read(assetsApiClientProvider).listAssets(
            search: _searchController.text,
            status: _statusFilter,
            category: _categoryFilter,
            page: 1,
            limit: 20,
          );
      if (!mounted) return;
      setState(() {
        _items = _applyServiceFocus(page.items);
        _page = page.page;
        _hasNext = page.hasNextPage && !widget.serviceFocus;
        _loading = false;
        _hasLoadedOnce = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
        if (!_hasLoadedOnce) _items = [];
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_isOffline || !_hasNext || widget.serviceFocus) return;
    setState(() => _loadingMore = true);
    try {
      final next = _page + 1;
      final page = await ref.read(assetsApiClientProvider).listAssets(
            search: _searchController.text,
            status: _statusFilter,
            category: _categoryFilter,
            page: next,
            limit: 20,
          );
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...page.items];
        _page = page.page;
        _hasNext = page.hasNextPage;
        _loadingMore = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingMore = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingMore = false;
        _error = e.toString();
      });
    }
  }

  String get _title {
    if (widget.serviceFocus) return 'Service due';
    if (_categoryFilter == 'MACHINE') return 'Machinery';
    return 'Assets';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              MpSpacing.screenPadding,
              MpSpacing.md,
              MpSpacing.screenPadding,
              MpSpacing.sm,
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onQueryChanged,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search tag, name, location…',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: MpSpacing.screenPadding,
              ),
              children: [
                for (final status in _statusFilters)
                  Padding(
                    padding: const EdgeInsets.only(right: MpSpacing.sm),
                    child: FilterChip(
                      label: Text(status ?? 'All'),
                      selected: _statusFilter == status,
                      onSelected: (_) {
                        setState(() => _statusFilter = status);
                        _refresh();
                      },
                    ),
                  ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(MpSpacing.md),
              child: MpErrorState(
                title: 'Could not load assets',
                message: _error,
                onRetry: _refresh,
              ),
            ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading assets…')
                : _items.isEmpty
                    ? MpEmptyState(
                        title: 'No assets found',
                        message: widget.serviceFocus
                            ? 'No assets are due or overdue in this page set.'
                            : 'Try another search or filter.',
                      )
                    : RefreshIndicator(
                        onRefresh: _refresh,
                        child: ListView.separated(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(MpSpacing.screenPadding),
                          itemCount: _items.length + (_loadingMore ? 1 : 0),
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: MpSpacing.sm),
                          itemBuilder: (context, index) {
                            if (index >= _items.length) {
                              return const Padding(
                                padding: EdgeInsets.all(MpSpacing.lg),
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
                              );
                            }
                            final asset = _items[index];
                            return MpCard(
                              child: MpListTile(
                                title: asset.name,
                                subtitle: [
                                  asset.assetTag,
                                  asset.category,
                                  asset.status,
                                  if (asset.location != null) asset.location!,
                                  if (asset.nextServiceDate != null)
                                    'Next ${asset.nextServiceDate!.toIso8601String().split('T').first}',
                                ].join(' · '),
                                leading: Icon(
                                  asset.category == 'MACHINE'
                                      ? Icons.miscellaneous_services_outlined
                                      : Icons.precision_manufacturing_outlined,
                                ),
                                trailing: asset.isServiceOverdue
                                    ? const MpStatusChip(
                                        label: 'Overdue',
                                        tone: MpStatusTone.error,
                                      )
                                    : asset.isServiceDueSoon
                                        ? const MpStatusChip(
                                            label: 'Due soon',
                                            tone: MpStatusTone.warning,
                                          )
                                        : null,
                                onTap: () =>
                                    context.push('/assets/${asset.id}'),
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
