import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';
import '../tenant/tenant_context.dart';
import 'auth_repository.dart';
import 'auth_session.dart';

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._ref) : super(AuthState.unknown);

  final Ref _ref;

  AuthRepository get _repo => _ref.read(authRepositoryProvider);

  Future<void> bootstrap() async {
    state = AuthState.unknown;
    try {
      final session = await _repo.restoreSession().timeout(
            const Duration(seconds: 6),
          );
      if (session == null) {
        state = AuthState.loggedOut;
        return;
      }
      _applyTenant(session);
      state = AuthState(
        status: AuthStatus.authenticated,
        session: session,
      );
    } catch (e) {
      // Timeout / storage / network: treat as logged out so splash can exit.
      state = AuthState.loggedOut;
    }
  }

  /// Clears a previous API error (e.g. before client-side form validation).
  void clearError() {
    if (state.errorMessage != null) {
      state = state.copyWith(clearError: true);
    }
  }

  Future<bool> login({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(clearError: true);
    try {
      final session = await _repo.login(email: email, password: password);
      _applyTenant(session);
      state = AuthState(
        status: AuthStatus.authenticated,
        session: session,
      );
      return true;
    } on ApiException catch (e) {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: e.message,
      );
      return false;
    } catch (e) {
      state = const AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: 'Unable to sign in. Please try again.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    _ref.read(tenantContextProvider.notifier).clear();
    state = AuthState.loggedOut;
  }

  void _applyTenant(AuthSession session) {
    final tenantId = session.user.tenantId;
    if (tenantId != null && tenantId.isNotEmpty) {
      _ref.read(tenantContextProvider.notifier).setTenantId(tenantId);
    }
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref);
});
