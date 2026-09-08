import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/maintenance_remote_datasource.dart';
import '../../data/models/maintenance_models.dart';

final maintenanceRemoteProvider = Provider<MaintenanceRemoteDataSource>((ref) {
  final dio = ref.watch(dioProvider);
  return MaintenanceRemoteDataSource(dio);
});

final maintenanceSchedulesProvider =
    FutureProvider.autoDispose<List<MaintenanceSchedule>>((ref) {
  return ref.watch(maintenanceRemoteProvider).listSchedules();
});

final maintenanceScheduleProvider =
    FutureProvider.autoDispose.family<MaintenanceSchedule, String>((ref, id) {
  return ref.watch(maintenanceRemoteProvider).getSchedule(id);
});

class MaintenanceLogsArgs {
  const MaintenanceLogsArgs({this.vehicleId});
  final String? vehicleId;

  @override
  bool operator ==(Object other) =>
      other is MaintenanceLogsArgs && other.vehicleId == vehicleId;
  @override
  int get hashCode => vehicleId.hashCode;
}

final maintenanceLogsProvider = FutureProvider.autoDispose
    .family<MaintenanceLogPage, MaintenanceLogsArgs>((ref, args) {
  return ref
      .watch(maintenanceRemoteProvider)
      .listLogs(vehicleId: args.vehicleId, page: 1, pageSize: 50);
});

final maintenanceCalendarProvider =
    FutureProvider.autoDispose<List<MaintenanceCalendarEntry>>((ref) {
  return ref.watch(maintenanceRemoteProvider).calendar();
});

final maintenancePredictiveAlertsProvider =
    FutureProvider.autoDispose<List<PredictiveAlert>>((ref) {
  return ref.watch(maintenanceRemoteProvider).predictiveAlerts();
});
