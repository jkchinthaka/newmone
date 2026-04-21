import '../config/app_config.dart';

class ApiEndpoints {
  static String get baseUrl => AppConfig.apiBaseUrl;

  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String workOrders = '/work-orders';
  static const String assets = '/assets';
  static const String notifications = '/notifications';
  static const String vehicles = '/vehicles';
}
