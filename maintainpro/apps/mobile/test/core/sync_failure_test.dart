import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/network/api_exception.dart';
import 'package:maintainpro_mobile/core/offline/sync_failure.dart';

void main() {
  const classifier = SyncFailureClassifier();

  group('SyncFailureClassifier', () {
    test('4xx client errors are permanent', () {
      expect(
        classifier.isPermanent(const BadRequestException('bad')),
        isTrue,
      );
      expect(
        classifier.isPermanent(const ForbiddenException('no')),
        isTrue,
      );
      expect(
        classifier.isPermanent(const NotFoundException('gone')),
        isTrue,
      );
      expect(
        classifier.isPermanent(const ConflictException('conflict')),
        isTrue,
      );
    });

    test('network and 5xx are retryable', () {
      expect(
        classifier.isPermanent(const NetworkException('down')),
        isFalse,
      );
      expect(
        classifier.isPermanent(
          const ServerException('boom', statusCode: 500),
        ),
        isFalse,
      );
      expect(
        classifier.isPermanent(const UnauthorizedException('expired')),
        isFalse,
      );
    });

    test('unknown handler is permanent', () {
      expect(
        classifier.isPermanent(
          SyncPermanentException('No sync handler for fleet'),
        ),
        isTrue,
      );
      expect(
        classifier.isPermanent(SyncRetryableException('timeout')),
        isFalse,
      );
    });
  });
}
