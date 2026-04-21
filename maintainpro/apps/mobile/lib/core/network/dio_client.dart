import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/token_storage.dart';
import 'api_endpoints.dart';

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(tokenStorageProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.readAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (!_shouldRefresh(error)) {
          handler.next(error);
          return;
        }

        final refreshToken = await storage.readRefreshToken();
        if (refreshToken == null || refreshToken.isEmpty) {
          await storage.clear();
          handler.next(error);
          return;
        }

        try {
          final refreshDio = Dio(
            BaseOptions(
              baseUrl: ApiEndpoints.baseUrl,
              headers: const {'Content-Type': 'application/json'},
            ),
          );

          final refreshResponse = await refreshDio.post(
            ApiEndpoints.refresh,
            data: {'refreshToken': refreshToken},
          );

          final body = refreshResponse.data;
          if (body is! Map<String, dynamic> ||
              body['success'] != true ||
              body['data'] is! Map<String, dynamic>) {
            throw const FormatException('Invalid refresh response.');
          }

          final data = body['data'] as Map<String, dynamic>;
          final nextAccessToken = (data['accessToken'] ?? '').toString();
          final nextRefreshToken =
              (data['refreshToken'] ?? refreshToken).toString();

          if (nextAccessToken.isEmpty) {
            throw const FormatException('Missing refreshed access token.');
          }

          await storage.saveTokens(
            accessToken: nextAccessToken,
            refreshToken: nextRefreshToken,
          );

          final retriedRequest = error.requestOptions.copyWith(
            headers: {
              ...error.requestOptions.headers,
              'Authorization': 'Bearer $nextAccessToken',
            },
          );

          final response = await dio.fetch<dynamic>(retriedRequest);
          handler.resolve(response);
          return;
        } catch (_) {
          await storage.clear();
        }

        handler.next(error);
      },
    ),
  );

  return dio;
});

bool _shouldRefresh(DioException error) {
  if (error.response?.statusCode != 401) {
    return false;
  }

  final path = error.requestOptions.path;
  return !path.endsWith(ApiEndpoints.login) &&
      !path.endsWith(ApiEndpoints.refresh);
}
