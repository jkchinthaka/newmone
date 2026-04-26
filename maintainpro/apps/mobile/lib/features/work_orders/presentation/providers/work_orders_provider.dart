import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/work_orders_remote_datasource.dart';
import '../../data/models/work_order.dart';

final workOrdersRemoteProvider = Provider<WorkOrdersRemoteDataSource>((ref) {
  return WorkOrdersRemoteDataSource(ref.watch(dioProvider));
});

final workOrdersFiltersProvider =
    StateProvider<WorkOrderListFilters>((_) => const WorkOrderListFilters());

class WorkOrdersListState {
  const WorkOrdersListState({
    this.items = const [],
    this.loading = false,
    this.error,
  });

  final List<WorkOrder> items;
  final bool loading;
  final String? error;

  WorkOrdersListState copyWith({
    List<WorkOrder>? items,
    bool? loading,
    Object? error = _sentinel,
  }) {
    return WorkOrdersListState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
      error: identical(error, _sentinel) ? this.error : error as String?,
    );
  }
}

const _sentinel = Object();

class WorkOrdersListNotifier extends Notifier<WorkOrdersListState> {
  @override
  WorkOrdersListState build() {
    // Reload whenever filters change.
    ref.listen<WorkOrderListFilters>(
      workOrdersFiltersProvider,
      (_, __) => load(),
    );
    Future.microtask(load);
    return const WorkOrdersListState(loading: true);
  }

  Future<void> load() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final remote = ref.read(workOrdersRemoteProvider);
      final all = await remote.list();
      state = state.copyWith(items: _applyFilters(all), loading: false);
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  Future<void> refresh() => load();

  List<WorkOrder> _applyFilters(List<WorkOrder> items) {
    final f = ref.read(workOrdersFiltersProvider);
    final me = ref.read(currentUserProvider)?.id;

    Iterable<WorkOrder> result = items;
    if (f.status != null) {
      result = result.where((w) => w.status == f.status);
    }
    if (f.priority != null) {
      result = result.where((w) => w.priority == f.priority);
    }
    if (f.type != null) {
      result = result.where((w) => w.type == f.type);
    }
    if (f.assignedToMe && me != null) {
      result = result.where((w) => w.technicianId == me);
    }
    final q = f.search?.trim().toLowerCase();
    if (q != null && q.isNotEmpty) {
      result = result.where((w) =>
          w.title.toLowerCase().contains(q) ||
          w.woNumber.toLowerCase().contains(q) ||
          w.description.toLowerCase().contains(q) ||
          (w.assetName ?? '').toLowerCase().contains(q));
    }
    return result.toList();
  }
}

final workOrdersListProvider =
    NotifierProvider<WorkOrdersListNotifier, WorkOrdersListState>(
  WorkOrdersListNotifier.new,
);

final workOrderDetailProvider =
    FutureProvider.family.autoDispose<WorkOrder, String>((ref, id) async {
  final remote = ref.watch(workOrdersRemoteProvider);
  return remote.getById(id);
});
