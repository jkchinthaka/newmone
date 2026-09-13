import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/config/app_config.dart';
import 'package:maintainpro_mobile/core/config/app_flavor.dart';

void main() {
  group('AppConfig URL safety', () {
    test('flags localhost, emulator, staging, and placeholder hosts', () {
      expect(AppConfig.isUnsafeApiBaseUrl('http://10.0.2.2:3000'), isTrue);
      expect(AppConfig.isUnsafeApiBaseUrl('http://localhost:3000'), isTrue);
      expect(AppConfig.isUnsafeApiBaseUrl('https://api.maintainpro.example.com'), isTrue);
      expect(AppConfig.isUnsafeApiBaseUrl('https://newmone.onrender.com'), isTrue);
      expect(AppConfig.isUnsafeApiBaseUrl('https://newmone.chinthakajayaweera1.workers.dev'), isTrue);
      expect(AppConfig.isUnsafeApiBaseUrl('http://135.171.163.249'), isTrue);
      expect(
        AppConfig.isUnsafeApiBaseUrl(
          'http://135.171.163.249',
          allowInsecureProdHttp: true,
        ),
        isFalse,
      );
      expect(AppConfig.isUnsafeApiBaseUrl('https://135.171.163.249'), isFalse);
    });

    test('normalizeApiBaseUrl appends /api once', () {
      expect(
        AppConfig.normalizeApiBaseUrl('http://135.171.163.249'),
        'http://135.171.163.249/api',
      );
      expect(
        AppConfig.normalizeApiBaseUrl('http://135.171.163.249/api'),
        'http://135.171.163.249/api',
      );
    });

    test('assertProductionSafeApiBaseUrl rejects staging and placeholders', () {
      expect(
        () => AppConfig.assertProductionSafeApiBaseUrl('https://newmone.onrender.com'),
        throwsStateError,
      );
      expect(
        () => AppConfig.assertProductionSafeApiBaseUrl('https://newmone.chinthakajayaweera1.workers.dev'),
        throwsStateError,
      );
      expect(
        () => AppConfig.assertProductionSafeApiBaseUrl('https://api.maintainpro.example.com'),
        throwsStateError,
      );
      expect(
        () => AppConfig.assertProductionSafeApiBaseUrl('http://135.171.163.249'),
        throwsStateError,
      );
      expect(
        () => AppConfig.assertProductionSafeApiBaseUrl(
          'http://135.171.163.249',
          allowInsecureProdHttp: true,
        ),
        returnsNormally,
      );
      expect(
        () => AppConfig.assertProductionSafeApiBaseUrl('https://135.171.163.249'),
        returnsNormally,
      );
      expect(
        () => AppConfig.assertProductionSafeApiBaseUrl(
          'http://192.168.1.1',
          allowInsecureProdHttp: true,
        ),
        throwsStateError,
      );
    });
  });

  test('prod flavor disables verbose logging via resolve contract', () {
    final config = AppConfig.resolve();
    if (config.flavor == AppFlavor.prod) {
      expect(config.enableLogging, isFalse);
    }
  });
}
