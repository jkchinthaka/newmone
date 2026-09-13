import 'app_flavor.dart';

/// Runtime configuration resolved from flavor + dart-defines.
///
/// Production builds **must** pass an explicit Windows Server public origin:
/// `--dart-define=APP_FLAVOR=prod --dart-define=API_BASE_URL=http://<PUBLIC_HOST>`
class AppConfig {
  AppConfig._({
    required this.flavor,
    required this.apiBaseUrl,
    required this.appName,
    required this.enableLogging,
  });

  final AppFlavor flavor;
  final String apiBaseUrl;
  final String appName;
  final bool enableLogging;

  /// Temporary pilot-only host authorized for explicit insecure HTTP prod builds.
  static const authorizedInsecureProdHost = '135.171.163.249';

  /// Host patterns that must never be used for production mobile builds.
  static const blockedProductionHostPatterns = [
    'example.com',
    'example.invalid',
    'localhost',
    '127.0.0.1',
    '10.0.2.2',
    'onrender.com',
    'render.com',
    'workers.dev',
    'vercel.app',
  ];

  /// API root including `/api` prefix.
  String get apiRoot => apiBaseUrl.endsWith('/api')
      ? apiBaseUrl
      : '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}/api';

  static AppConfig resolve() {
    final flavor = AppFlavor.fromDefine();
    const override = String.fromEnvironment('API_BASE_URL');
    final base = _resolveApiBaseUrl(flavor: flavor, override: override);
    return AppConfig._(
      flavor: flavor,
      apiBaseUrl: base,
      appName: 'MaintainPro',
      enableLogging: flavor != AppFlavor.prod,
    );
  }

  /// Validates prod dart-defines before the app boots.
  static void ensureProductionReady() {
    final flavor = AppFlavor.fromDefine();
    if (flavor != AppFlavor.prod) return;
    const override = String.fromEnvironment('API_BASE_URL');
    _resolveApiBaseUrl(flavor: flavor, override: override);
  }

  static bool allowInsecureProdHttpFromDefine() {
    const raw = String.fromEnvironment('ALLOW_INSECURE_PROD_HTTP');
    return raw.trim().toLowerCase() == 'true';
  }

  static String _resolveApiBaseUrl({
    required AppFlavor flavor,
    required String override,
  }) {
    if (flavor == AppFlavor.prod) {
      if (override.trim().isEmpty) {
        throw StateError(
          'Production builds require --dart-define=API_BASE_URL=<Windows Server public origin>. '
          'Use the operator-configured PUBLIC_HOST from production Docker/nginx (not Render staging).',
        );
      }
      assertProductionSafeApiBaseUrl(
        override,
        allowInsecureProdHttp: allowInsecureProdHttpFromDefine(),
      );
      return normalizeApiBaseUrl(override);
    }

    if (override.isNotEmpty) {
      return normalizeApiBaseUrl(override);
    }
    return _defaultBaseUrl(flavor);
  }

  static String normalizeApiBaseUrl(String raw) {
    final trimmed = raw.trim().replaceAll(RegExp(r'/+$'), '');
    if (trimmed.isEmpty) {
      throw ArgumentError('API_BASE_URL must not be empty');
    }
    return trimmed.endsWith('/api') ? trimmed : '$trimmed/api';
  }

  static bool isUnsafeApiBaseUrl(
    String raw, {
    bool allowInsecureProdHttp = false,
  }) {
    final value = raw.trim().toLowerCase();
    if (value.isEmpty) return true;

    for (final pattern in blockedProductionHostPatterns) {
      if (value.contains(pattern)) return true;
    }

    final uri = Uri.tryParse(raw.trim());
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) return true;
    if (uri.scheme != 'http' && uri.scheme != 'https') return true;

    if (uri.scheme == 'http') {
      if (!allowInsecureProdHttp) return true;
      if (uri.host != authorizedInsecureProdHost) return true;
    }

    return false;
  }

  static void assertProductionSafeApiBaseUrl(
    String raw, {
    bool allowInsecureProdHttp = false,
  }) {
    if (isUnsafeApiBaseUrl(raw, allowInsecureProdHttp: allowInsecureProdHttp)) {
      final uri = Uri.tryParse(raw.trim());
      if (uri?.scheme == 'http') {
        if (!allowInsecureProdHttp) {
          throw StateError(
            'Production HTTP is blocked. Pass --dart-define=ALLOW_INSECURE_PROD_HTTP=true '
            'with --dart-define=API_BASE_URL=http://$authorizedInsecureProdHost for the temporary pilot only.',
          );
        }
        throw StateError(
          'Production HTTP is allowed only for http://$authorizedInsecureProdHost '
          'when ALLOW_INSECURE_PROD_HTTP=true.',
        );
      }
      throw StateError(
        'Invalid production API_BASE_URL. Use the Windows Server Docker/nginx PUBLIC_HOST only. '
        'Staging hosts (Render/Workers), localhost, emulator hosts, and placeholders are rejected.',
      );
    }
  }

  static String _defaultBaseUrl(AppFlavor flavor) {
    switch (flavor) {
      case AppFlavor.dev:
        return 'http://10.0.2.2:3000';
      case AppFlavor.uat:
        return 'https://uat-api.maintainpro.example.com';
      case AppFlavor.prod:
        throw StateError(
          'Production flavor has no default API URL. Pass --dart-define=API_BASE_URL=...',
        );
    }
  }
}
