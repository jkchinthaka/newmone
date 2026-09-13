import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/supplier.dart';

class SuppliersRemoteDataSource {
  SuppliersRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  Future<List<Supplier>> list() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.suppliers);
      final data = _unwrap(res);
      if (data is List) {
        return data
            .whereType<Map>()
            .map((e) => Supplier.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
      return const [];
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Supplier> getById(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.supplierById(id));
      return Supplier.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Supplier> create({
    required String name,
    String? contactName,
    String? email,
    String? phone,
    String? address,
    String? website,
    String? taxNumber,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.suppliers,
        data: {
          'name': name,
          if (contactName != null) 'contactName': contactName,
          if (email != null) 'email': email,
          if (phone != null) 'phone': phone,
          if (address != null) 'address': address,
          if (website != null) 'website': website,
          if (taxNumber != null) 'taxNumber': taxNumber,
          if (notes != null) 'notes': notes,
        },
      );
      return Supplier.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Supplier> update(
    String id, {
    String? name,
    String? contactName,
    String? email,
    String? phone,
    String? address,
    String? website,
    String? taxNumber,
    String? notes,
    bool? isActive,
  }) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.supplierById(id),
        data: {
          if (name != null) 'name': name,
          if (contactName != null) 'contactName': contactName,
          if (email != null) 'email': email,
          if (phone != null) 'phone': phone,
          if (address != null) 'address': address,
          if (website != null) 'website': website,
          if (taxNumber != null) 'taxNumber': taxNumber,
          if (notes != null) 'notes': notes,
          if (isActive != null) 'isActive': isActive,
        },
      );
      return Supplier.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
