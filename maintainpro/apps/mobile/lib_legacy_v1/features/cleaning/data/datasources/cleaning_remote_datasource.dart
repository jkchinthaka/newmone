import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/cleaning_location.dart';
import '../models/cleaning_visit.dart';
import '../models/facility_issue.dart';

class CleaningRemoteDataSource {
  CleaningRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  // ── Locations ──────────────────────────────────────────────────────────
  Future<List<CleaningLocation>> listLocations() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.cleaningLocations);
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(CleaningLocation.fromJson)
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<CleaningLocation> getLocation(String id) async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.cleaningLocationById(id));
      final data = _unwrap(res);
      return CleaningLocation.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Scan / Visit lifecycle ─────────────────────────────────────────────
  /// Quick "mark cleaned" via POST /cleaning/scan.
  Future<Map<String, dynamic>> scan(
    String qrCode, {
    double? latitude,
    double? longitude,
    String? deviceId,
    DateTime? clientScannedAt,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.cleaningScan,
        data: {
          'qrCode': qrCode,
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
          if (deviceId != null) 'deviceId': deviceId,
          if (clientScannedAt != null)
            'clientScannedAt': clientScannedAt.toIso8601String(),
        },
      );
      final data = _unwrap(res);
      return Map<String, dynamic>.from(data as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  /// Start a visit (with checklist flow) via POST /cleaning/visits/scan.
  Future<CleaningVisit> startVisit(
    String qrCode, {
    double? latitude,
    double? longitude,
    String? deviceId,
    List<String>? beforePhotos,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.cleaningVisitsScan,
        data: {
          'qrCode': qrCode,
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
          if (deviceId != null) 'deviceId': deviceId,
          if (beforePhotos != null && beforePhotos.isNotEmpty)
            'beforePhotos': beforePhotos,
        },
      );
      final data = _unwrap(res);
      return CleaningVisit.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<CleaningVisit> submitVisit(
    String visitId, {
    required List<VisitChecklistItem> checklist,
    List<String>? afterPhotos,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.cleaningVisitSubmit(visitId),
        data: {
          'checklist': checklist.map((e) => e.toJson()).toList(),
          if (afterPhotos != null && afterPhotos.isNotEmpty)
            'afterPhotos': afterPhotos,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        },
      );
      final data = _unwrap(res);
      return CleaningVisit.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<CleaningVisit> signOffVisit(
    String visitId, {
    required bool approve,
    String? notes,
    int? rating,
    String? rejectionReason,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.cleaningVisitSignOff(visitId),
        data: {
          'approve': approve,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
          if (rating != null) 'rating': rating,
          if (rejectionReason != null && rejectionReason.isNotEmpty)
            'rejectionReason': rejectionReason,
        },
      );
      final data = _unwrap(res);
      return CleaningVisit.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Visits ─────────────────────────────────────────────────────────────
  Future<({List<CleaningVisit> items, int total})> listVisits({
    String? status,
    String? locationId,
    String? cleanedBy,
    DateTime? date,
    int page = 1,
    int pageSize = 30,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.cleaningVisits,
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
          if (status != null) 'status': status,
          if (locationId != null) 'locationId': locationId,
          if (cleanedBy != null) 'cleanedBy': cleanedBy,
          if (date != null) 'date': date.toIso8601String().substring(0, 10),
        },
      );
      final data = _unwrap(res);
      if (data is Map<String, dynamic>) {
        final list = (data['items'] as List?) ?? const [];
        final pagination = (data['pagination'] as Map?) ?? const {};
        return (
          items: list
              .whereType<Map<String, dynamic>>()
              .map(CleaningVisit.fromJson)
              .toList(),
          total: (pagination['total'] as num?)?.toInt() ?? list.length,
        );
      }
      if (data is List) {
        return (
          items: data
              .whereType<Map<String, dynamic>>()
              .map(CleaningVisit.fromJson)
              .toList(),
          total: data.length,
        );
      }
      return (items: <CleaningVisit>[], total: 0);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<CleaningVisit> getVisit(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.cleaningVisitById(id));
      final data = _unwrap(res);
      return CleaningVisit.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Issues ─────────────────────────────────────────────────────────────
  Future<List<FacilityIssue>> listIssues({String? status}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.cleaningIssues,
        queryParameters: {if (status != null) 'status': status},
      );
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(FacilityIssue.fromJson)
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FacilityIssue> createIssue({
    required String title,
    required String description,
    String? severity,
    String? locationId,
    String? assignedToId,
    int? slaHours,
    List<String>? photos,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.cleaningIssues,
        data: {
          'title': title,
          'description': description,
          if (severity != null) 'severity': severity,
          if (locationId != null) 'locationId': locationId,
          if (assignedToId != null) 'assignedToId': assignedToId,
          if (slaHours != null) 'slaHours': slaHours,
          if (photos != null && photos.isNotEmpty) 'photos': photos,
        },
      );
      final data = _unwrap(res);
      return FacilityIssue.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FacilityIssue> updateIssue(
    String id, {
    String? status,
    String? resolution,
    String? assignedToId,
  }) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.cleaningIssueById(id),
        data: {
          if (status != null) 'status': status,
          if (resolution != null) 'resolution': resolution,
          if (assignedToId != null) 'assignedToId': assignedToId,
        },
      );
      final data = _unwrap(res);
      return FacilityIssue.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
