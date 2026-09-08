import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/asset.dart';

class AssetsRemoteDataSource {
  AssetsRemoteDataSource(this._dio);

  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  Future<List<Asset>> list({
    String? status,
    String? category,
    String? condition,
    String? location,
    String? search,
    bool includeArchived = false,
    int page = 1,
    int limit = 100,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.assets,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (status != null) 'status': status,
          if (category != null) 'category': category,
          if (condition != null) 'condition': condition,
          if (location != null) 'location': location,
          if (search != null && search.isNotEmpty) 'search': search,
          if (includeArchived) 'includeArchived': 'true',
        },
      );
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(Asset.fromJson)
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Asset> getById(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.assetById(id));
      final data = _unwrap(res);
      if (data is! Map<String, dynamic>) {
        throw const NotFoundException('Asset not found');
      }
      return Asset.fromJson(data);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  /// Validates an asset tag (used by QR scanner). Returns lookup with `exists`
  /// + `assetId` if known.
  Future<AssetTagLookup> validateTag(String assetTag) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.assetsValidateTag,
        queryParameters: {'assetTag': assetTag},
      );
      final data = _unwrap(res);
      if (data is! Map<String, dynamic>) {
        return const AssetTagLookup(exists: false);
      }
      return AssetTagLookup.fromJson(data);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> getQrCode(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.assetQr(id));
      final data = _unwrap(res);
      return Map<String, dynamic>.from(data as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Asset> updateStatus(String id, String status,
      {String? disposalReason}) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.assetStatus(id),
        data: {
          'status': status,
          if (disposalReason != null) 'disposalReason': disposalReason,
        },
      );
      final data = _unwrap(res);
      return Asset.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
