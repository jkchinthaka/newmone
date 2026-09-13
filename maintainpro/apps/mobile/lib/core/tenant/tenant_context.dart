import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/secure_token_store.dart';

class TenantContext {
  const TenantContext({this.tenantId});

  final String? tenantId;

  bool get hasTenant => tenantId != null && tenantId!.isNotEmpty;

  TenantContext copyWith({String? tenantId}) =>
      TenantContext(tenantId: tenantId ?? this.tenantId);
}

class TenantContextNotifier extends StateNotifier<TenantContext> {
  TenantContextNotifier(this._tokens) : super(const TenantContext());

  final SecureTokenStore _tokens;

  Future<void> hydrate() async {
    final id = await _tokens.readTenantId();
    state = TenantContext(tenantId: id);
  }

  Future<void> setTenantId(String tenantId) async {
    await _tokens.saveTenantId(tenantId);
    state = TenantContext(tenantId: tenantId);
  }

  Future<void> clear() async {
    await _tokens.saveTenantId(null);
    state = const TenantContext();
  }
}

final tenantContextProvider =
    StateNotifierProvider<TenantContextNotifier, TenantContext>((ref) {
  return TenantContextNotifier(ref.watch(secureTokenStoreProvider));
});
