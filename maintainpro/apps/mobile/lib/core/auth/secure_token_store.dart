import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Persists JWT + tenant secrets in platform secure storage.
class SecureTokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  static const _accessKey = 'mp_access_token';
  static const _refreshKey = 'mp_refresh_token';
  static const _tenantKey = 'mp_tenant_id';
  static const _userIdKey = 'mp_user_id';
  static const _pushInstallationKey = 'mp_push_installation_id';

  final FlutterSecureStorage _storage;

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  Future<void> saveTenantId(String? tenantId) async {
    if (tenantId == null || tenantId.isEmpty) {
      await _storage.delete(key: _tenantKey);
    } else {
      await _storage.write(key: _tenantKey, value: tenantId);
    }
  }

  Future<String?> readTenantId() => _storage.read(key: _tenantKey);

  Future<void> saveUserId(String? userId) async {
    if (userId == null || userId.isEmpty) {
      await _storage.delete(key: _userIdKey);
    } else {
      await _storage.write(key: _userIdKey, value: userId);
    }
  }

  Future<String?> readUserId() => _storage.read(key: _userIdKey);

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Future<String> getOrCreatePushInstallationId() async {
    final existing = await _storage.read(key: _pushInstallationKey);
    if (existing != null && existing.trim().isNotEmpty) {
      return existing.trim();
    }
    const uuid = Uuid();
    final created = uuid.v4();
    await _storage.write(key: _pushInstallationKey, value: created);
    return created;
  }

  Future<String?> readPushInstallationId() =>
      _storage.read(key: _pushInstallationKey);

  Future<void> clearAll() async {
    await clearTokens();
    await _storage.delete(key: _tenantKey);
    await _storage.delete(key: _userIdKey);
  }

  Future<bool> hasSession() async {
    final access = await readAccessToken();
    return access != null && access.isNotEmpty;
  }
}

final secureTokenStoreProvider = Provider<SecureTokenStore>((ref) {
  return SecureTokenStore();
});
