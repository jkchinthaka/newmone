import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/farm_models.dart';

class FarmRemoteDataSource {
  FarmRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  List<T> _list<T>(
    dynamic data,
    T Function(Map<String, dynamic>) f,
  ) {
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => f(Map<String, dynamic>.from(e)))
          .toList();
    }
    return <T>[];
  }

  // ── Fields ──
  Future<List<FarmField>> fields({String? status}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmFields,
        queryParameters: {if (status != null) 'status': status},
      );
      return _list(_unwrap(res), FarmField.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FarmField> field(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.farmFieldById(id));
      return FarmField.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FarmField> createField(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(ApiEndpoints.farmFields, data: body);
      return FarmField.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FarmField> updateField(String id, Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.patch<dynamic>(ApiEndpoints.farmFieldById(id), data: body);
      return FarmField.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Crops ──
  Future<List<CropCycle>> crops({String? status, String? fieldId}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmCrops,
        queryParameters: {
          if (status != null) 'status': status,
          if (fieldId != null) 'fieldId': fieldId,
        },
      );
      return _list(_unwrap(res), CropCycle.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<CropCycle> crop(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.farmCropById(id));
      return CropCycle.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<CropCycle> createCrop(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(ApiEndpoints.farmCrops, data: body);
      return CropCycle.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<CropCycle> updateCrop(String id, Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.patch<dynamic>(ApiEndpoints.farmCropById(id), data: body);
      return CropCycle.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Harvest ──
  Future<List<HarvestRecord>> harvests({String? cropCycleId}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmHarvest,
        queryParameters: {
          if (cropCycleId != null) 'cropCycleId': cropCycleId,
        },
      );
      return _list(_unwrap(res), HarvestRecord.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<HarvestRecord> createHarvest(Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.post<dynamic>(ApiEndpoints.farmHarvest, data: body);
      return HarvestRecord.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Livestock ──
  Future<List<LivestockAnimal>> animals(
      {String? species, String? status}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmLivestockAnimals,
        queryParameters: {
          if (species != null) 'species': species,
          if (status != null) 'status': status,
        },
      );
      return _list(_unwrap(res), LivestockAnimal.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<LivestockAnimal> animal(String id) async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.farmLivestockAnimalById(id));
      return LivestockAnimal.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<LivestockAnimal> createAnimal(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(ApiEndpoints.farmLivestockAnimals,
          data: body);
      return LivestockAnimal.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<AnimalHealthRecord>> animalHealth(String animalId) async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.farmAnimalHealth(animalId));
      return _list(_unwrap(res), AnimalHealthRecord.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<AnimalHealthRecord> createAnimalHealth(
      String animalId, Map<String, dynamic> body) async {
    try {
      final res = await _dio
          .post<dynamic>(ApiEndpoints.farmAnimalHealth(animalId), data: body);
      return AnimalHealthRecord.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<AnimalProductionLog>> animalProduction(String animalId) async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.farmAnimalProduction(animalId));
      return _list(_unwrap(res), AnimalProductionLog.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<AnimalProductionLog> createAnimalProduction(
      String animalId, Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(
          ApiEndpoints.farmAnimalProduction(animalId),
          data: body);
      return AnimalProductionLog.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<FeedingLog>> feedings() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.farmFeeding);
      return _list(_unwrap(res), FeedingLog.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FeedingLog> createFeeding(Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.post<dynamic>(ApiEndpoints.farmFeeding, data: body);
      return FeedingLog.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Irrigation ──
  Future<List<IrrigationLog>> irrigations({String? fieldId}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmIrrigation,
        queryParameters: {if (fieldId != null) 'fieldId': fieldId},
      );
      return _list(_unwrap(res), IrrigationLog.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<IrrigationLog> createIrrigation(Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.post<dynamic>(ApiEndpoints.farmIrrigation, data: body);
      return IrrigationLog.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Spray ──
  Future<List<SprayLog>> sprayLogs({String? fieldId}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmSpray,
        queryParameters: {if (fieldId != null) 'fieldId': fieldId},
      );
      return _list(_unwrap(res), SprayLog.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<SprayLog> createSpray(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(ApiEndpoints.farmSpray, data: body);
      return SprayLog.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Soil tests ──
  Future<List<SoilTest>> soilTests({String? fieldId}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmSoilTests,
        queryParameters: {if (fieldId != null) 'fieldId': fieldId},
      );
      return _list(_unwrap(res), SoilTest.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<SoilTest> createSoilTest(Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.post<dynamic>(ApiEndpoints.farmSoilTests, data: body);
      return SoilTest.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Weather ──
  Future<List<WeatherLog>> weatherLogs() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.farmWeather);
      return _list(_unwrap(res), WeatherLog.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<WeatherLog>> weatherAlerts() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.farmWeatherAlerts);
      return _list(_unwrap(res), WeatherLog.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<WeatherLog> createWeather(Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.post<dynamic>(ApiEndpoints.farmWeather, data: body);
      return WeatherLog.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Workers ──
  Future<List<FarmWorker>> workers({String? status}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmWorkers,
        queryParameters: {if (status != null) 'status': status},
      );
      return _list(_unwrap(res), FarmWorker.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FarmWorker> worker(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.farmWorkerById(id));
      return FarmWorker.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FarmWorker> createWorker(Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.post<dynamic>(ApiEndpoints.farmWorkers, data: body);
      return FarmWorker.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<AttendanceLog>> workerAttendance(String workerId) async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.farmWorkerAttendance(workerId));
      return _list(_unwrap(res), AttendanceLog.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<AttendanceLog>> tenantAttendance({
    required String tenantId,
    String? from,
    String? to,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmWorkersAttendance,
        queryParameters: {
          'tenantId': tenantId,
          if (from != null) 'from': from,
          if (to != null) 'to': to,
        },
      );
      return _list(_unwrap(res), AttendanceLog.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<AttendanceLog> recordAttendance(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.farmWorkersAttendance,
        data: body,
      );
      return AttendanceLog.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Finance ──
  Future<FarmFinanceSummary> financeSummary({
    String? tenantId,
    String? from,
    String? to,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmFinanceSummary,
        queryParameters: {
          if (tenantId != null) 'tenantId': tenantId,
          if (from != null) 'from': from,
          if (to != null) 'to': to,
        },
      );
      return FarmFinanceSummary.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<FarmExpense>> expenses({String? category}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmFinanceExpenses,
        queryParameters: {if (category != null) 'category': category},
      );
      return _list(_unwrap(res), FarmExpense.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FarmExpense> createExpense(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(ApiEndpoints.farmFinanceExpenses,
          data: body);
      return FarmExpense.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<FarmIncome>> incomes({String? source}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.farmFinanceIncome,
        queryParameters: {if (source != null) 'source': source},
      );
      return _list(_unwrap(res), FarmIncome.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FarmIncome> createIncome(Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.post<dynamic>(ApiEndpoints.farmFinanceIncome, data: body);
      return FarmIncome.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Traceability ──
  Future<List<TraceabilityRecord>> traceability() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.farmTraceability);
      return _list(_unwrap(res), TraceabilityRecord.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<TraceabilityRecord> createTraceability(
      Map<String, dynamic> body) async {
    try {
      final res =
          await _dio.post<dynamic>(ApiEndpoints.farmTraceability, data: body);
      return TraceabilityRecord.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
