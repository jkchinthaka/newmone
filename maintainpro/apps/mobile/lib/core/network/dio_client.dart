import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../auth/secure_token_store.dart';
import '../config/app_config.dart';
import '../tenant/tenant_context.dart';
import 'api_exception.dart';

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.resolve());

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  final tokens = ref.watch(secureTokenStoreProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiRoot,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  Completer<String?>? refreshLock;

  Future<String?> refreshAccessToken() {
    if (refreshLock != null) return refreshLock!.future;
    final completer = Completer<String?>();
    refreshLock = completer;

    () async {
      try {
        final refresh = await tokens.readRefreshToken();
        if (refresh == null || refresh.isEmpty) {
          completer.complete(null);
          return;
        }

        final refreshDio = Dio(
          BaseOptions(
            baseUrl: config.apiRoot,
            headers: const {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        );

        final response = await refreshDio.post<dynamic>(
          '/auth/refresh',
          data: {'refreshToken': refresh},
        );

        final payload = _unwrapData(response.data);
        final access = (payload?['accessToken'] ?? '').toString();
        final nextRefresh =
            (payload?['refreshToken'] ?? refresh).toString();
        if (access.isEmpty) {
          completer.complete(null);
          return;
        }

        await tokens.saveTokens(
          accessToken: access,
          refreshToken: nextRefresh,
        );
        completer.complete(access);
      } catch (_) {
        await tokens.clearTokens();
        completer.complete(null);
      } finally {
        refreshLock = null;
      }
    }();

    return completer.future;
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final access = await tokens.readAccessToken();
        if (access != null && access.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $access';
        }

        final tenantId = ref.read(tenantContextProvider).tenantId ??
            await tokens.readTenantId();
        if (tenantId != null && tenantId.isNotEmpty) {
          options.headers['X-Tenant-Id'] = tenantId;
        }

        options.headers['X-Request-Id'] ??= const Uuid().v4();
        options.headers['X-Correlation-Id'] ??=
            options.headers['X-Request-Id'];

        handler.next(options);
      },
      onError: (error, handler) async {
        final status = error.response?.statusCode;
        final path = error.requestOptions.path;
        final isAuthCall = path.contains('/auth/login') ||
            path.contains('/auth/refresh') ||
            path.contains('/auth/logout');

        if (status == 401 && !isAuthCall) {
          final next = await refreshAccessToken();
          if (next != null && next.isNotEmpty) {
            final req = error.requestOptions;
            req.headers['Authorization'] = 'Bearer $next';
            try {
              final clone = await dio.fetch<dynamic>(req);
              handler.resolve(clone);
              return;
            } catch (e) {
              if (e is DioException) {
                handler.next(e);
                return;
              }
            }
          }
        }

        handler.next(error);
      },
    ),
  );

  if (config.enableLogging) {
    dio.interceptors.add(
      LogInterceptor(
        requestBody: false,
        responseBody: false,
        error: true,
        requestHeader: false,
        responseHeader: false,
      ),
    );
  }

  return dio;
});

Map<String, dynamic>? _unwrapData(dynamic body) {
  if (body is! Map) return null;
  final map = Map<String, dynamic>.from(body);
  if (map['data'] is Map) {
    return Map<String, dynamic>.from(map['data'] as Map);
  }
  return map;
}

/// Helper to convert Dio errors into [ApiException].
Never throwApiException(Object error) {
  if (error is DioException) {
    throw ApiException.fromDio(error);
  }
  throw UnknownApiException(error.toString());
}
