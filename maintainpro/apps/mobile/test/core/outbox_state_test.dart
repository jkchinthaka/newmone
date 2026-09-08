import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/database/app_database.dart';

void main() {
  group('OutboxStateCodec', () {
    test('round-trips wire values', () {
      for (final state in OutboxState.values) {
        final parsed = OutboxStateCodec.parse(state.wire);
        expect(parsed, state);
        expect(parsed.wire, state.wire);
      }
    });

    test('parses known backend strings', () {
      expect(OutboxStateCodec.parse('LOCAL_DRAFT'), OutboxState.localDraft);
      expect(OutboxStateCodec.parse('QUEUED'), OutboxState.queued);
      expect(OutboxStateCodec.parse('SYNCING'), OutboxState.syncing);
      expect(OutboxStateCodec.parse('SYNCED'), OutboxState.synced);
      expect(OutboxStateCodec.parse('CONFLICT'), OutboxState.conflict);
      expect(
        OutboxStateCodec.parse('FAILED_RETRYABLE'),
        OutboxState.failedRetryable,
      );
      expect(
        OutboxStateCodec.parse('FAILED_PERMANENT'),
        OutboxState.failedPermanent,
      );
    });

    test('unknown values default to queued', () {
      expect(OutboxStateCodec.parse('NOPE'), OutboxState.queued);
    });
  });
}
