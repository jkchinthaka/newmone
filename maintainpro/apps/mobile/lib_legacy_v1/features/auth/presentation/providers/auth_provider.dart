import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/token_storage.dart';
import '../../../../shared/models/app_user.dart';
import '../../data/datasources/auth_remote_datasource.dart';

sealed class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);

  final AppUser user;
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthError extends AuthState {
  const AuthError(this.message);

  final String message;
}

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  final dio = ref.watch(dioProvider);
  return AuthRemoteDataSource(dio);
});

final authStateProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

final currentUserProvider = Provider<AppUser?>((ref) {
  final state = ref.watch(authStateProvider);
  if (state is AuthAuthenticated) {
    return state.user;
  }
  return null;
});

class AuthNotifier extends Notifier<AuthState> {
  late final AuthRemoteDataSource _remote;
  late final TokenStorage _storage;

  bool _sessionChecked = false;

  @override
  AuthState build() {
    _remote = ref.read(authRemoteDataSourceProvider);
    _storage = ref.read(tokenStorageProvider);
    return const AuthInitial();
  }

  Future<void> restoreSession() async {
    if (_sessionChecked) {
      return;
    }

    _sessionChecked = true;
    state = const AuthLoading();

    final accessToken = await _storage.readAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      state = const AuthUnauthenticated();
      return;
    }

    try {
      final user = await _remote.me();
      state = AuthAuthenticated(user);
      return;
    } catch (_) {
      final refreshed = await _refreshSession();
      if (!refreshed) {
        await _storage.clear();
        state = const AuthUnauthenticated();
        return;
      }
    }

    try {
      final user = await _remote.me();
      state = AuthAuthenticated(user);
    } catch (_) {
      await _storage.clear();
      state = const AuthUnauthenticated();
    }
  }

  Future<void> login({required String email, required String password}) async {
    state = const AuthLoading();

    try {
      final response = await _remote.login(email: email, password: password);
      await _persistSession(response);
      state = AuthAuthenticated(response.user);
    } catch (error) {
      state = AuthError(_errorMessage(error));
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
    String? tenantName,
  }) async {
    state = const AuthLoading();
    try {
      final response = await _remote.register(
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        tenantName: tenantName,
      );
      await _persistSession(response);
      state = AuthAuthenticated(response.user);
    } catch (error) {
      state = AuthError(_errorMessage(error));
    }
  }

  Future<bool> forgotPassword(String email) async {
    try {
      await _remote.forgotPassword(email);
      return true;
    } catch (error) {
      state = AuthError(_errorMessage(error));
      return false;
    }
  }

  Future<bool> resetPassword(
      {required String token, required String password}) async {
    try {
      await _remote.resetPassword(token: token, password: password);
      return true;
    } catch (error) {
      state = AuthError(_errorMessage(error));
      return false;
    }
  }

  Future<void> _persistSession(dynamic response) async {
    await _storage.saveTokens(
      accessToken: response.accessToken as String,
      refreshToken: response.refreshToken as String,
    );
    final user = response.user as AppUser;
    await _storage.saveUser(jsonEncode(user.toJson()));
  }

  Future<void> logout() async {
    state = const AuthLoading();

    try {
      final refreshToken = await _storage.readRefreshToken();
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _remote.logout(refreshToken);
      }
    } catch (_) {
      // Always continue with local sign-out when remote logout fails.
    }

    await _storage.clear();
    state = const AuthUnauthenticated();
  }

  Future<bool> _refreshSession() async {
    try {
      final refreshToken = await _storage.readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        return false;
      }

      final refreshed = await _remote.refresh(refreshToken);
      final nextAccess = (refreshed['accessToken'] ?? '').trim();
      if (nextAccess.isEmpty) {
        return false;
      }

      await _storage.saveTokens(
        accessToken: nextAccess,
        refreshToken: (refreshed['refreshToken'] ?? refreshToken).trim(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  String _errorMessage(Object error) {
    final message = error.toString();
    if (message.startsWith('Exception: ')) {
      return message.replaceFirst('Exception: ', '');
    }

    return message;
  }
}
