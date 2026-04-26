import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final tokenStorageProvider = Provider<TokenStorage>((_) => TokenStorage());

/// Secure storage for auth tokens, tenant id, and serialized user.
/// All keys prefixed with `maintainpro_`.
class TokenStorage {
  static const _accessTokenKey = 'maintainpro_access_token';
  static const _refreshTokenKey = 'maintainpro_refresh_token';
  static const _userKey = 'maintainpro_user';
  static const _tenantIdKey = 'maintainpro_tenant_id';

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
  }

  Future<void> saveUser(String userJson) =>
      _secureStorage.write(key: _userKey, value: userJson);

  Future<void> saveTenantId(String tenantId) =>
      _secureStorage.write(key: _tenantIdKey, value: tenantId);

  Future<String?> readAccessToken() =>
      _secureStorage.read(key: _accessTokenKey);

  Future<String?> readRefreshToken() =>
      _secureStorage.read(key: _refreshTokenKey);

  Future<String?> readUser() => _secureStorage.read(key: _userKey);

  Future<String?> readTenantId() => _secureStorage.read(key: _tenantIdKey);

  Future<void> clear() async {
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _userKey);
    await _secureStorage.delete(key: _tenantIdKey);
  }
}
