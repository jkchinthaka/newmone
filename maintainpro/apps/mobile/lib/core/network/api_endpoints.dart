class ApiEndpoints {
  static const String baseUrl = String.fromEnvironment(
    'MAINTAINPRO_API_URL',
    defaultValue: 'http://localhost:3000/api',
  );

  static const String login = '/auth/login';
  static const String workOrders = '/work-orders';
  static const String assets = '/assets';
  static const String notifications = '/notifications';
  static const String vehicles = '/vehicles';
}
