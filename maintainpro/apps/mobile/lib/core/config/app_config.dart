import 'app_flavor.dart';

/// Runtime configuration resolved from flavor + dart-defines.
///
/// Override URLs without rebuilding flavors:
/// `--dart-define=API_BASE_URL=https://api.example.com`
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

  /// API root including `/api` prefix.
  String get apiRoot => apiBaseUrl.endsWith('/api')
      ? apiBaseUrl
      : '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}/api';

  static AppConfig resolve() {
    final flavor = AppFlavor.fromDefine();
    const override = String.fromEnvironment('API_BASE_URL');
    final base = override.isNotEmpty ? override : _defaultBaseUrl(flavor);
    return AppConfig._(
      flavor: flavor,
      apiBaseUrl: base,
      appName: 'MaintainPro',
      enableLogging: flavor != AppFlavor.prod,
    );
  }

  static String _defaultBaseUrl(AppFlavor flavor) {
    switch (flavor) {
      case AppFlavor.dev:
        // Placeholder — replace with LAN IP / emulator host for local API.
        return 'http://10.0.2.2:3000';
      case AppFlavor.uat:
        return 'https://uat-api.maintainpro.example.com';
      case AppFlavor.prod:
        return 'https://api.maintainpro.example.com';
    }
  }
}
