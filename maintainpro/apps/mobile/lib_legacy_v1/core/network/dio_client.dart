import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/token_storage.dart';
import 'api_endpoints.dart';

/// Dio singleton with auth + tenant + atomic refresh + logging interceptors.
final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(tokenStorageProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  // Atomic refresh lock — guarantees only one refresh call at a time.
  Completer<String?>? refreshCompleter;

  Future<String?> refreshAccessToken() {
    if (refreshCompleter != null) return refreshCompleter!.future;

    final completer = Completer<String?>();
    refreshCompleter = completer;

    () async {
      try {
        final refreshToken = await storage.readRefreshToken();
        if (refreshToken == null || refreshToken.isEmpty) {
          completer.complete(null);
          return;
        }

        final refreshDio = Dio(BaseOptions(
          baseUrl: ApiEndpoints.baseUrl,
          headers: const {'Content-Type': 'application/json'},
        ));

        final response = await refreshDio.post<dynamic>(
          ApiEndpoints.refresh,
          data: {'refreshToken': refreshToken},
        );

        final body = response.data;
        Map<String, dynamic>? data;
        if (body is Map<String, dynamic>) {
          if (body['data'] is Map<String, dynamic>) {
            data = body['data'] as Map<String, dynamic>;
          } else if (body.containsKey('accessToken')) {
            data = body;
          }
        }
        if (data == null) {
          completer.complete(null);
          return;
        }

        final access = (data['accessToken'] ?? '').toString();
        final refresh = (data['refreshToken'] ?? refreshToken).toString();
        if (access.isEmpty) {
          completer.complete(null);
          return;
        }

        await storage.saveTokens(accessToken: access, refreshToken: refresh);
        completer.complete(access);
      } catch (_) {
        await storage.clear();
        completer.complete(null);
      } finally {
        refreshCompleter = null;
      }
    }();

    return completer.future;
  }

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await storage.readAccessToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      final tenantId = await storage.readTenantId();
      if (tenantId != null && tenantId.isNotEmpty) {
        options.headers['X-Tenant-Id'] = tenantId;
      }
      handler.next(options);
    },
    onError: (error, handler) async {
      if (!_shouldRefresh(error)) {
        handler.next(error);
        return;
      }

      final newAccessToken = await refreshAccessToken();
      if (newAccessToken == null) {
        await storage.clear();
        handler.next(error);
        return;
      }

      try {
        final retried = await dio.fetch<dynamic>(
          error.requestOptions.copyWith(
            headers: {
              ...error.requestOptions.headers,
              'Authorization': 'Bearer $newAccessToken',
            },
          ),
        );
        handler.resolve(retried);
      } catch (e) {
        if (e is DioException) {
          handler.next(e);
        } else {
          handler.next(error);
        }
      }
    },
  ));

  if (kDebugMode) {
    dio.interceptors.add(LogInterceptor(
      request: false,
      requestHeader: false,
      requestBody: false,
      responseHeader: false,
      responseBody: false,
      error: true,
    ));
  }

  return dio;
});

bool _shouldRefresh(DioException error) {
  if (error.response?.statusCode != 401) return false;
  final path = error.requestOptions.path;
  return !path.endsWith(ApiEndpoints.login) &&
      !path.endsWith(ApiEndpoints.refresh) &&
      !path.endsWith(ApiEndpoints.register) &&
      !path.endsWith(ApiEndpoints.forgotPassword);
}
