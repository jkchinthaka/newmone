/// Authenticated user session snapshot.
class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.tenantId,
    this.permissions = const [],
  });

  final String id;
  final String email;
  final String name;
  final String role;
  final String? tenantId;
  final List<String> permissions;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final permissionsRaw = json['permissions'];
    final permissions = <String>[];
    if (permissionsRaw is List) {
      permissions.addAll(permissionsRaw.map((e) => e.toString()));
    }

    final first = (json['firstName'] ?? '').toString();
    final last = (json['lastName'] ?? '').toString();
    final combined = '$first $last'.trim();
    final name = (json['name'] ?? json['fullName'] ?? combined).toString();

    return AuthUser(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      name: name.isEmpty ? (json['email'] ?? 'User').toString() : name,
      role: (json['role'] ?? 'VIEWER').toString().toUpperCase(),
      tenantId: json['tenantId']?.toString(),
      permissions: permissions,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'role': role,
        'tenantId': tenantId,
        'permissions': permissions,
      };
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final AuthUser user;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    final userJson = json['user'];
    if (userJson is! Map) {
      throw const FormatException('Login response missing user');
    }
    return AuthSession(
      accessToken: (json['accessToken'] ?? '').toString(),
      refreshToken: (json['refreshToken'] ?? '').toString(),
      user: AuthUser.fromJson(Map<String, dynamic>.from(userJson)),
    );
  }
}

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({
    required this.status,
    this.session,
    this.errorMessage,
  });

  final AuthStatus status;
  final AuthSession? session;
  final String? errorMessage;

  AuthUser? get user => session?.user;

  bool get isAuthenticated =>
      status == AuthStatus.authenticated && session != null;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    String? errorMessage,
    bool clearError = false,
    bool clearSession = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: clearSession ? null : (session ?? this.session),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  static const unknown = AuthState(status: AuthStatus.unknown);
  static const loggedOut = AuthState(status: AuthStatus.unauthenticated);
}
