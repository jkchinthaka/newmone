import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';

class PushNotificationsRemoteDataSource {
  PushNotificationsRemoteDataSource(this._dio);

  final Dio _dio;

  Future<void> registerDevice({
    required String installationId,
    required String token,
    required String platform,
    required String provider,
    String? appVersion,
    String? locale,
    String? deviceName,
  }) async {
    try {
      await _dio.post<dynamic>(
        ApiEndpoints.notificationsPushDevices,
        data: {
          'installationId': installationId,
          'token': token,
          'platform': platform,
          'provider': provider,
          if (appVersion != null && appVersion.isNotEmpty)
            'appVersion': appVersion,
          if (locale != null && locale.isNotEmpty) 'locale': locale,
          if (deviceName != null && deviceName.isNotEmpty)
            'deviceName': deviceName,
        },
      );
    } on DioException catch (error) {
      throw NetworkException.fromDio(error);
    }
  }

  Future<void> unregisterDevice(String installationId) async {
    try {
      await _dio.delete<dynamic>(
        ApiEndpoints.notificationPushDevice(installationId),
      );
    } on DioException catch (error) {
      throw NetworkException.fromDio(error);
    }
  }
}