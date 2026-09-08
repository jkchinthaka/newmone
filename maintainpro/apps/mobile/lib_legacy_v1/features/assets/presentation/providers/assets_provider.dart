import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/assets_remote_datasource.dart';
import '../../data/models/asset.dart';

final assetsRemoteProvider = Provider<AssetsRemoteDataSource>((ref) {
  return AssetsRemoteDataSource(ref.watch(dioProvider));
});

final assetsFiltersProvider =
    StateProvider<AssetListFilters>((_) => const AssetListFilters());

class AssetsListState {
  const AssetsListState({
    this.items = const [],
    this.loading = false,
    this.error,
  });

  final List<Asset> items;
  final bool loading;
  final String? error;

  AssetsListState copyWith({
    List<Asset>? items,
    bool? loading,
    Object? error = _sentinel,
  }) {
    return AssetsListState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
      error: identical(error, _sentinel) ? this.error : error as String?,
    );
  }
}

const _sentinel = Object();

class AssetsListNotifier extends Notifier<AssetsListState> {
  @override
  AssetsListState build() {
    ref.listen<AssetListFilters>(assetsFiltersProvider, (_, __) => load());
    Future.microtask(load);
    return const AssetsListState(loading: true);
  }

  Future<void> load() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final f = ref.read(assetsFiltersProvider);
      final remote = ref.read(assetsRemoteProvider);
      final items = await remote.list(
        status: f.status,
        category: f.category,
        condition: f.condition,
        location: f.location,
        search: f.search,
        includeArchived: f.includeArchived,
      );
      state = state.copyWith(items: items, loading: false);
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  Future<void> refresh() => load();
}

final assetsListProvider =
    NotifierProvider<AssetsListNotifier, AssetsListState>(
  AssetsListNotifier.new,
);

final assetDetailProvider =
    FutureProvider.family.autoDispose<Asset, String>((ref, id) async {
  final remote = ref.watch(assetsRemoteProvider);
  return remote.getById(id);
});

/// Lookup an asset tag scanned from a QR code.
final assetTagLookupProvider =
    FutureProvider.family.autoDispose<AssetTagLookup, String>((ref, tag) async {
  final remote = ref.watch(assetsRemoteProvider);
  return remote.validateTag(tag);
});
