import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';
import '../network/dio_client.dart';
import 'auth_session.dart';
import 'secure_token_store.dart';

class AuthRepository {
  AuthRepository({
    required Dio dio,
    required SecureTokenStore tokens,
  })  : _dio = dio,
        _tokens = tokens;

  final Dio _dio;
  final SecureTokenStore _tokens;

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/auth/login',
        data: {'email': email.trim(), 'password': password},
      );
      final payload = _unwrap(response.data);
      if (payload == null) {
        throw const BadRequestException('Invalid login response');
      }
      final session = AuthSession.fromJson(payload);
      if (session.accessToken.isEmpty || session.refreshToken.isEmpty) {
        throw const BadRequestException('Login response missing tokens');
      }
      await _tokens.saveTokens(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      );
      await _tokens.saveUserId(session.user.id);
      final tenantId = session.user.tenantId;
      if (tenantId != null && tenantId.isNotEmpty) {
        await _tokens.saveTenantId(tenantId);
      }
      return session;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<AuthSession?> restoreSession() async {
    final has = await _tokens.hasSession();
    if (!has) return null;

    try {
      final response = await _dio.get<dynamic>('/auth/me');
      final payload = _unwrap(response.data);
      if (payload == null) return null;

      final userMap = payload['user'] is Map
          ? Map<String, dynamic>.from(payload['user'] as Map)
          : payload;
      final user = AuthUser.fromJson(userMap);
      final access = await _tokens.readAccessToken() ?? '';
      final refresh = await _tokens.readRefreshToken() ?? '';
      if (access.isEmpty) return null;
      return AuthSession(
        accessToken: access,
        refreshToken: refresh,
        user: user,
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await _tokens.clearTokens();
        return null;
      }
      // Offline / server blip: keep tokens, synthesize minimal session.
      final access = await _tokens.readAccessToken();
      final refresh = await _tokens.readRefreshToken();
      if (access == null || access.isEmpty) return null;
      final userId = await _tokens.readUserId() ?? 'unknown';
      final tenantId = await _tokens.readTenantId();
      return AuthSession(
        accessToken: access,
        refreshToken: refresh ?? '',
        user: AuthUser(
          id: userId,
          email: '',
          name: 'User',
          role: 'VIEWER',
          tenantId: tenantId,
        ),
      );
    }
  }

  Future<void> logout() async {
    final refresh = await _tokens.readRefreshToken();
    try {
      if (refresh != null && refresh.isNotEmpty) {
        await _dio.post<dynamic>(
          '/auth/logout',
          data: {'refreshToken': refresh},
        );
      }
    } catch (_) {
      // Best-effort server logout; always clear local secrets.
    } finally {
      await _tokens.clearAll();
    }
  }

  Map<String, dynamic>? _unwrap(dynamic body) {
    if (body is! Map) return null;
    final map = Map<String, dynamic>.from(body);
    if (map['data'] is Map) {
      return Map<String, dynamic>.from(map['data'] as Map);
    }
    return map;
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    dio: ref.watch(dioProvider),
    tokens: ref.watch(secureTokenStoreProvider),
  );
});
