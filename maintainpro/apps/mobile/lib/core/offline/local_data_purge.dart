import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/secure_token_store.dart';
import '../database/app_database.dart';

/// Purges tenant/user-scoped local SQLite on logout for shared-device safety.
class LocalDataPurge {
  LocalDataPurge(this._db, this._tokens);

  final AppDatabase _db;
  final SecureTokenStore _tokens;

  Future<void> onLogout() async {
    final tenantId = await _tokens.readTenantId();
    final userId = await _tokens.readUserId();
    if (tenantId != null &&
        tenantId.isNotEmpty &&
        userId != null &&
        userId.isNotEmpty &&
        tenantId != 'unknown' &&
        userId != 'unknown') {
      await _db.purgeUserLocalData(tenantId: tenantId, userId: userId);
      return;
    }
    await _db.purgeAllLocalData();
  }
}

final localDataPurgeProvider = Provider<LocalDataPurge>((ref) {
  return LocalDataPurge(
    ref.watch(appDatabaseProvider),
    ref.watch(secureTokenStoreProvider),
  );
});
