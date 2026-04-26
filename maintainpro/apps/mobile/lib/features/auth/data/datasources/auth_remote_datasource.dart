import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../shared/models/app_user.dart';
import '../models/auth_response.dart';

class AuthRemoteDataSource {
  AuthRemoteDataSource(this._dio);

  final Dio _dio;

  Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.login,
      data: {
        'email': email,
        'password': password,
      },
    );

    final payload = _readEnvelope(response.data);
    return AuthResponse.fromJson(payload);
  }

  Future<AuthResponse> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
    String? tenantName,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.register,
      data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (tenantName != null && tenantName.isNotEmpty)
          'tenantName': tenantName,
      },
    );

    final payload = _readEnvelope(response.data);
    return AuthResponse.fromJson(payload);
  }

  Future<void> forgotPassword(String email) async {
    await _dio.post(
      ApiEndpoints.forgotPassword,
      data: {'email': email},
    );
  }

  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    await _dio.post(
      ApiEndpoints.resetPassword,
      data: {'token': token, 'password': password},
    );
  }

  Future<AppUser> me() async {
    final response = await _dio.get(ApiEndpoints.me);
    final payload = _readEnvelope(response.data);
    return AppUser.fromJson(payload);
  }

  Future<Map<String, String>> refresh(String refreshToken) async {
    final response = await _dio.post(
      ApiEndpoints.refresh,
      data: {'refreshToken': refreshToken},
    );

    final payload = _readEnvelope(response.data);
    return {
      'accessToken': (payload['accessToken'] ?? '').toString(),
      'refreshToken': (payload['refreshToken'] ?? refreshToken).toString(),
    };
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post(
      ApiEndpoints.logout,
      data: {'refreshToken': refreshToken},
    );
  }

  Map<String, dynamic> _readEnvelope(dynamic raw) {
    if (raw is! Map<String, dynamic>) {
      throw const FormatException('Invalid API response format.');
    }

    final message = (raw['message'] ?? 'Request failed').toString();

    if (raw['success'] == false) {
      throw DioException(
        requestOptions: RequestOptions(path: ''),
        error: message,
        type: DioExceptionType.badResponse,
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: ''),
          data: raw,
          statusCode: 400,
        ),
      );
    }

    final data = raw['data'];
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Missing response data payload.');
    }

    return data;
  }
}
