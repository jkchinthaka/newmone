import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/farm_remote_datasource.dart';
import '../../data/models/farm_models.dart';

final farmRemoteProvider = Provider<FarmRemoteDataSource>((ref) {
  return FarmRemoteDataSource(ref.watch(dioProvider));
});

// Fields
final farmFieldsProvider = FutureProvider.autoDispose<List<FarmField>>((ref) {
  return ref.watch(farmRemoteProvider).fields();
});
final farmFieldProvider =
    FutureProvider.autoDispose.family<FarmField, String>((ref, id) {
  return ref.watch(farmRemoteProvider).field(id);
});

// Crops
final farmCropsProvider = FutureProvider.autoDispose<List<CropCycle>>((ref) {
  return ref.watch(farmRemoteProvider).crops();
});
final farmCropProvider =
    FutureProvider.autoDispose.family<CropCycle, String>((ref, id) {
  return ref.watch(farmRemoteProvider).crop(id);
});
final farmCropsByFieldProvider =
    FutureProvider.autoDispose.family<List<CropCycle>, String>((ref, fieldId) {
  return ref.watch(farmRemoteProvider).crops(fieldId: fieldId);
});

// Harvest
final farmHarvestsProvider =
    FutureProvider.autoDispose<List<HarvestRecord>>((ref) {
  return ref.watch(farmRemoteProvider).harvests();
});

// Livestock
final farmAnimalsProvider =
    FutureProvider.autoDispose<List<LivestockAnimal>>((ref) {
  return ref.watch(farmRemoteProvider).animals();
});
final farmAnimalProvider =
    FutureProvider.autoDispose.family<LivestockAnimal, String>((ref, id) {
  return ref.watch(farmRemoteProvider).animal(id);
});
final farmAnimalHealthProvider = FutureProvider.autoDispose
    .family<List<AnimalHealthRecord>, String>((ref, animalId) {
  return ref.watch(farmRemoteProvider).animalHealth(animalId);
});
final farmAnimalProductionProvider = FutureProvider.autoDispose
    .family<List<AnimalProductionLog>, String>((ref, animalId) {
  return ref.watch(farmRemoteProvider).animalProduction(animalId);
});
final farmFeedingsProvider =
    FutureProvider.autoDispose<List<FeedingLog>>((ref) {
  return ref.watch(farmRemoteProvider).feedings();
});

// Irrigation, spray, soil tests, weather
final farmIrrigationsProvider =
    FutureProvider.autoDispose<List<IrrigationLog>>((ref) {
  return ref.watch(farmRemoteProvider).irrigations();
});
final farmSprayLogsProvider = FutureProvider.autoDispose<List<SprayLog>>((ref) {
  return ref.watch(farmRemoteProvider).sprayLogs();
});
final farmSoilTestsProvider = FutureProvider.autoDispose<List<SoilTest>>((ref) {
  return ref.watch(farmRemoteProvider).soilTests();
});
final farmWeatherLogsProvider =
    FutureProvider.autoDispose<List<WeatherLog>>((ref) {
  return ref.watch(farmRemoteProvider).weatherLogs();
});
final farmWeatherAlertsProvider =
    FutureProvider.autoDispose<List<WeatherLog>>((ref) {
  return ref.watch(farmRemoteProvider).weatherAlerts();
});

// Workers
final farmWorkersProvider = FutureProvider.autoDispose<List<FarmWorker>>((ref) {
  return ref.watch(farmRemoteProvider).workers();
});
final farmWorkerProvider =
    FutureProvider.autoDispose.family<FarmWorker, String>((ref, id) {
  return ref.watch(farmRemoteProvider).worker(id);
});
final farmWorkerAttendanceProvider = FutureProvider.autoDispose
    .family<List<AttendanceLog>, String>((ref, workerId) {
  return ref.watch(farmRemoteProvider).workerAttendance(workerId);
});

// Finance
final farmFinanceSummaryProvider =
    FutureProvider.autoDispose<FarmFinanceSummary>((ref) {
  return ref.watch(farmRemoteProvider).financeSummary();
});
final farmExpensesProvider =
    FutureProvider.autoDispose<List<FarmExpense>>((ref) {
  return ref.watch(farmRemoteProvider).expenses();
});
final farmIncomesProvider = FutureProvider.autoDispose<List<FarmIncome>>((ref) {
  return ref.watch(farmRemoteProvider).incomes();
});

// Traceability
final farmTraceabilityProvider =
    FutureProvider.autoDispose<List<TraceabilityRecord>>((ref) {
  return ref.watch(farmRemoteProvider).traceability();
});
