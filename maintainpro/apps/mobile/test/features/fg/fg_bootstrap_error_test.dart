import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/network/api_exception.dart';
import 'package:maintainpro_mobile/features/fg/fg_bootstrap_error.dart';

void main() {
  group('fgBootstrapUserMessage', () {
    test('404 on mobile/fg bootstrap explains gateway not deployed', () {
      final msg = fgBootstrapUserMessage(
        const NotFoundException(
          'Cannot POST /api/mobile/fg/session/bootstrap',
          code: 'NOT_FOUND',
        ),
      );
      expect(msg, contains('FG mobile gateway is not available'));
      expect(msg, isNot(contains('135.171')));
      expect(msg, isNot(contains('unexpected error occurred')));
    });

    test('403 maps to permission denied', () {
      final msg = fgBootstrapUserMessage(
        const ForbiddenException(
          'Missing required permission: fg.access',
          code: 'FORBIDDEN',
        ),
      );
      expect(msg, contains('permission'));
      expect(msg, contains('fg.access'));
    });

    test('401 maps to session expired', () {
      final msg = fgBootstrapUserMessage(
        const UnauthorizedException('Unauthorized', code: 'AUTHENTICATION_REQUIRED'),
      );
      expect(msg, contains('session expired'));
    });

    test('503 FG broker misconfiguration', () {
      final msg = fgBootstrapUserMessage(
        const ServerException(
          'FG mobile broker is not configured (FG_API_INTERNAL_URL)',
          statusCode: 503,
          code: 'UPSTREAM_UNAVAILABLE',
        ),
      );
      expect(msg, contains('not configured'));
    });

    test('generic 500 avoids internal wording', () {
      final msg = fgBootstrapUserMessage(
        const ServerException(
          'An unexpected error occurred',
          statusCode: 500,
        ),
      );
      expect(msg, contains('temporarily unavailable'));
      expect(msg, isNot(contains('unexpected error occurred')));
    });

    test('network errors stay safe', () {
      final msg = fgBootstrapUserMessage(
        const NetworkException('Unable to reach the server'),
      );
      expect(msg, contains('connection'));
    });
  });
}
