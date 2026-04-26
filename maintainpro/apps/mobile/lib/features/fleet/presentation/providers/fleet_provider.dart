import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/fleet_remote_datasource.dart';
import '../../data/datasources/fleet_socket.dart';
import '../../data/models/driver.dart';
import '../../data/models/fuel_log.dart';
import '../../data/models/gps_ping.dart';
import '../../data/models/trip.dart';
import '../../data/models/vehicle.dart';

final fleetRemoteProvider = Provider<FleetRemoteDataSource>((ref) {
  final dio = ref.watch(dioProvider);
  return FleetRemoteDataSource(dio);
});

// ── Vehicles ────────────────────────────────────────────────────────────
final vehicleListFiltersProvider =
    StateProvider<VehicleListFilters>((_) => const VehicleListFilters());

class VehicleListState {
  const VehicleListState({
    this.items = const [],
    this.total = 0,
    this.loading = false,
    this.error,
  });

  final List<Vehicle> items;
  final int total;
  final bool loading;
  final String? error;

  VehicleListState copyWith({
    List<Vehicle>? items,
    int? total,
    bool? loading,
    Object? error = _vlsSentinel,
  }) {
    return VehicleListState(
      items: items ?? this.items,
      total: total ?? this.total,
      loading: loading ?? this.loading,
      error: identical(error, _vlsSentinel) ? this.error : error as String?,
    );
  }
}

const _vlsSentinel = Object();

class VehiclesNotifier extends Notifier<VehicleListState> {
  @override
  VehicleListState build() {
    ref.listen<VehicleListFilters>(
      vehicleListFiltersProvider,
      (_, __) => Future.microtask(load),
    );
    Future.microtask(load);
    return const VehicleListState();
  }

  Future<void> load() async {
    final filters = ref.read(vehicleListFiltersProvider);
    state = state.copyWith(loading: true, error: null);
    try {
      final res = await ref.read(fleetRemoteProvider).listVehicles(
            q: filters.q,
            statuses: filters.statuses,
            sortBy: filters.sortBy,
            sortDir: filters.sortDir,
            page: filters.page,
            pageSize: filters.pageSize,
          );
      state = VehicleListState(
        items: res.items,
        total: res.total,
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  Future<void> refresh() => load();
}

final vehiclesProvider =
    NotifierProvider<VehiclesNotifier, VehicleListState>(VehiclesNotifier.new);

final vehicleDetailProvider =
    FutureProvider.family.autoDispose<Vehicle, String>((ref, id) async {
  return ref.read(fleetRemoteProvider).getVehicle(id);
});

final vehicleSummaryProvider =
    FutureProvider.autoDispose<VehicleSummary>((ref) async {
  return ref.read(fleetRemoteProvider).vehicleSummary();
});

// ── Drivers ─────────────────────────────────────────────────────────────
final driversProvider = FutureProvider.autoDispose<List<Driver>>((ref) async {
  return ref.read(fleetRemoteProvider).listDrivers();
});

final driverDetailProvider =
    FutureProvider.family.autoDispose<Driver, String>((ref, id) async {
  return ref.read(fleetRemoteProvider).getDriver(id);
});

// ── Fuel ────────────────────────────────────────────────────────────────
final allFuelLogsProvider =
    FutureProvider.autoDispose<List<FuelLog>>((ref) async {
  return ref.read(fleetRemoteProvider).listAllFuelLogs();
});

final vehicleFuelLogsProvider =
    FutureProvider.family.autoDispose<List<FuelLog>, String>((ref, id) async {
  return ref.read(fleetRemoteProvider).listVehicleFuelLogs(id);
});

final vehicleFuelAnalyticsProvider =
    FutureProvider.family.autoDispose<FuelAnalytics, String>((ref, id) async {
  return ref.read(fleetRemoteProvider).vehicleFuelAnalytics(id);
});

// ── Trips ───────────────────────────────────────────────────────────────
final allTripsProvider = FutureProvider.autoDispose<List<Trip>>((ref) async {
  return ref.read(fleetRemoteProvider).listAllTrips();
});

final vehicleTripsProvider =
    FutureProvider.family.autoDispose<List<Trip>, String>((ref, id) async {
  return ref.read(fleetRemoteProvider).listVehicleTrips(id);
});

final tripGpsHistoryProvider = FutureProvider.family
    .autoDispose<List<GpsPing>, String>((ref, vehicleId) async {
  return ref.read(fleetRemoteProvider).vehicleHistory(vehicleId);
});

// ── Live map ────────────────────────────────────────────────────────────
final liveFleetMapProvider =
    FutureProvider.autoDispose<List<GpsPing>>((ref) async {
  return ref.read(fleetRemoteProvider).liveMap();
});

/// Streams socket location updates after the initial REST snapshot.
final liveFleetUpdatesProvider = StreamProvider.autoDispose<GpsPing>((ref) {
  final socket = ref.watch(fleetSocketProvider);
  return socket.locationUpdates;
});

final fleetAlertsProvider =
    FutureProvider.autoDispose<List<FleetAlert>>((ref) async {
  return ref.read(fleetRemoteProvider).listFleetAlerts();
});

final fleetLiveAlertsProvider = StreamProvider.autoDispose<FleetAlert>((ref) {
  final socket = ref.watch(fleetSocketProvider);
  return socket.alerts;
});
