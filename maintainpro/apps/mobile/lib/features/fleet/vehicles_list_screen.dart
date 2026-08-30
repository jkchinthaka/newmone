import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/fleet_api_client.dart';
import 'data/fleet_models.dart';

const _statusFilters = <String?>[
  null,
  'AVAILABLE',
  'IN_USE',
  'UNDER_MAINTENANCE',
  'OUT_OF_SERVICE',
];

/// Paginated vehicles list with search, status chips, pull-to-refresh.
class VehiclesListScreen extends ConsumerStatefulWidget {
  const VehiclesListScreen({super.key});

  @override
  ConsumerState<VehiclesListScreen> createState() => _VehiclesListScreenState();
}

class _VehiclesListScreenState extends ConsumerState<VehiclesListScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _debounce;

  List<Vehicle> _items = [];
  int _page = 1;
  bool _hasNext = false;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String? _statusFilter;
  bool _hasLoadedOnce = false;

  @override
  void initState() {
    super.initState();
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

  Future<void> _refresh() async {
    if (_isOffline && !_hasLoadedOnce) {
      setState(() {
        _loading = false;
        _error = 'Vehicles require connection (no cached list yet)';
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
      final page = await ref.read(fleetApiClientProvider).listVehicles(
            q: _searchController.text,
            status: _statusFilter,
            page: 1,
            pageSize: 20,
          );
      if (!mounted) return;
      setState(() {
        _items = page.items;
        _page = page.pagination.page;
        _hasNext = page.pagination.hasNextPage;
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
    if (_isOffline || !_hasNext) return;
    setState(() => _loadingMore = true);
    try {
      final next = _page + 1;
      final page = await ref.read(fleetApiClientProvider).listVehicles(
            q: _searchController.text,
            status: _statusFilter,
            page: next,
            pageSize: 20,
          );
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...page.items];
        _page = page.pagination.page;
        _hasNext = page.pagination.hasNextPage;
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

  MpStatusTone _statusTone(String? status) {
    switch ((status ?? '').toUpperCase()) {
      case 'AVAILABLE':
        return MpStatusTone.success;
      case 'IN_USE':
        return MpStatusTone.info;
      case 'UNDER_MAINTENANCE':
        return MpStatusTone.warning;
      case 'OUT_OF_SERVICE':
      case 'DISPOSED':
        return MpStatusTone.error;
      default:
        return MpStatusTone.neutral;
    }
  }

  @override
  Widget build(BuildContext context) {
    final offline =
        ref.watch(syncControllerProvider).phase == SyncPhase.offline;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Vehicles')),
      body: Column(
        children: [
          if (offline)
            Material(
              color: scheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(MpSpacing.md),
                child: Row(
                  children: [
                    Icon(Icons.cloud_off, color: scheme.onErrorContainer),
                    const SizedBox(width: MpSpacing.sm),
                    Expanded(
                      child: Text(
                        _hasLoadedOnce
                            ? 'Offline — showing last loaded list. Mutations disabled.'
                            : 'Vehicles require connection',
                        style: TextStyle(color: scheme.onErrorContainer),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              MpSpacing.screenPadding,
              MpSpacing.md,
              MpSpacing.screenPadding,
              0,
            ),
            child: MpTextField(
              controller: _searchController,
              label: 'Search registration, make, tag',
              prefixIcon: Icons.search,
              onChanged: _onQueryChanged,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _refresh(),
            ),
          ),
          const SizedBox(height: MpSpacing.sm),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: MpSpacing.screenPadding,
              ),
              children: _statusFilters.map((s) {
                final selected = _statusFilter == s;
                final label = s == null ? 'All' : s.replaceAll('_', ' ');
                return Padding(
                  padding: const EdgeInsets.only(right: MpSpacing.sm),
                  child: FilterChip(
                    label: Text(label),
                    selected: selected,
                    onSelected: offline
                        ? null
                        : (_) {
                            setState(() => _statusFilter = s);
                            _refresh();
                          },
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: _loading
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        MpLoading(message: 'Loading vehicles…'),
                      ],
                    )
                  : _error != null && _items.isEmpty
                      ? ListView(
                          children: [
                            MpErrorState(
                              title: 'Could not load vehicles',
                              message: _error,
                              onRetry: _refresh,
                            ),
                          ],
                        )
                      : _items.isEmpty
                          ? ListView(
                              children: const [
                                MpEmptyState(
                                  title: 'No vehicles',
                                  message: 'Try a different search or filter.',
                                  icon: Icons.directions_car_outlined,
                                ),
                              ],
                            )
                          : ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.all(
                                MpSpacing.screenPadding,
                              ),
                              itemCount: _items.length + (_loadingMore ? 1 : 0),
                              itemBuilder: (context, index) {
                                if (index >= _items.length) {
                                  return const Padding(
                                    padding: EdgeInsets.all(MpSpacing.lg),
                                    child: Center(
                                      child: CircularProgressIndicator(),
                                    ),
                                  );
                                }
                                final v = _items[index];
                                return Padding(
                                  padding: const EdgeInsets.only(
                                      bottom: MpSpacing.md),
                                  child: MpCard(
                                    onTap: () =>
                                        context.push('/fleet/vehicles/${v.id}'),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          v.displayLabel,
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium,
                                        ),
                                        const SizedBox(height: MpSpacing.xs),
                                        Text(
                                          [
                                            if (v.make != null) v.make,
                                            if (v.vehicleModel != null)
                                              v.vehicleModel,
                                          ].whereType<String>().join(' '),
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                        const SizedBox(height: MpSpacing.sm),
                                        Wrap(
                                          spacing: MpSpacing.sm,
                                          runSpacing: MpSpacing.xs,
                                          children: [
                                            if (v.status != null)
                                              MpStatusChip(
                                                label: v.status!
                                                    .replaceAll('_', ' '),
                                                tone: _statusTone(v.status),
                                              ),
                                            if (v.driverName != null ||
                                                v.driverId != null)
                                              MpStatusChip(
                                                label:
                                                    'Driver ${v.driverName ?? v.driverId}',
                                              ),
                                            if (v.currentMileage != null)
                                              MpStatusChip(
                                                label:
                                                    '${v.currentMileage!.toStringAsFixed(0)} km',
                                              ),
                                            MpStatusChip(
                                              label:
                                                  'Service ${healthLabelText(v.healthLabel)}',
                                              tone: switch (v.healthLabel) {
                                                VehicleHealthLabel.critical =>
                                                  MpStatusTone.error,
                                                VehicleHealthLabel.attention =>
                                                  MpStatusTone.warning,
                                                VehicleHealthLabel.healthy =>
                                                  MpStatusTone.success,
                                              },
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
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
