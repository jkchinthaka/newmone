import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/cleaning_remote_datasource.dart';
import '../../data/models/cleaning_location.dart';
import '../../data/models/cleaning_visit.dart';
import '../../data/models/facility_issue.dart';

final cleaningRemoteProvider = Provider<CleaningRemoteDataSource>((ref) {
  return CleaningRemoteDataSource(ref.watch(dioProvider));
});

// ── Locations ──
final cleaningLocationsProvider =
    FutureProvider.autoDispose<List<CleaningLocation>>((ref) async {
  return ref.watch(cleaningRemoteProvider).listLocations();
});

final cleaningLocationDetailProvider = FutureProvider.family
    .autoDispose<CleaningLocation, String>((ref, id) async {
  return ref.watch(cleaningRemoteProvider).getLocation(id);
});

// ── Visits ──
final cleaningVisitsFiltersProvider =
    StateProvider<CleaningVisitFilters>((_) => const CleaningVisitFilters());

class CleaningVisitsListState {
  const CleaningVisitsListState({
    this.items = const [],
    this.loading = false,
    this.error,
    this.total = 0,
  });

  final List<CleaningVisit> items;
  final bool loading;
  final String? error;
  final int total;

  CleaningVisitsListState copyWith({
    List<CleaningVisit>? items,
    bool? loading,
    Object? error = _sentinel,
    int? total,
  }) {
    return CleaningVisitsListState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
      error: identical(error, _sentinel) ? this.error : error as String?,
      total: total ?? this.total,
    );
  }
}

const _sentinel = Object();

class CleaningVisitsNotifier extends Notifier<CleaningVisitsListState> {
  @override
  CleaningVisitsListState build() {
    ref.listen<CleaningVisitFilters>(
      cleaningVisitsFiltersProvider,
      (_, __) => load(),
    );
    Future.microtask(load);
    return const CleaningVisitsListState(loading: true);
  }

  Future<void> load() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final f = ref.read(cleaningVisitsFiltersProvider);
      final me = ref.read(currentUserProvider)?.id;
      final remote = ref.read(cleaningRemoteProvider);
      final result = await remote.listVisits(
        status: f.status,
        locationId: f.locationId,
        cleanedBy: f.assignedToMe ? me : null,
        date: f.date,
      );
      state = state.copyWith(
        items: result.items,
        total: result.total,
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  Future<void> refresh() => load();
}

final cleaningVisitsProvider =
    NotifierProvider<CleaningVisitsNotifier, CleaningVisitsListState>(
  CleaningVisitsNotifier.new,
);

final cleaningVisitDetailProvider =
    FutureProvider.family.autoDispose<CleaningVisit, String>((ref, id) async {
  return ref.watch(cleaningRemoteProvider).getVisit(id);
});

// ── Issues ──
final facilityIssuesFilterProvider = StateProvider<String?>((_) => null);

final facilityIssuesProvider =
    FutureProvider.autoDispose<List<FacilityIssue>>((ref) async {
  final status = ref.watch(facilityIssuesFilterProvider);
  return ref.watch(cleaningRemoteProvider).listIssues(status: status);
});
