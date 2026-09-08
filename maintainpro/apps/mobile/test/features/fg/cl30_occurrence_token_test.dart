import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/features/fg/data/fg_models.dart';
import 'package:uuid/uuid.dart';

void main() {
  group('CL30 occurrenceToken', () {
    test('uuid.v4 matches allowed pattern', () {
      final token = const Uuid().v4();
      expect(isValidCl30OccurrenceToken(token), isTrue);
      expect(token.length, greaterThanOrEqualTo(8));
      expect(token.length, lessThanOrEqualTo(80));
    });

    test('accepts alphanumerics dots underscores hyphens', () {
      expect(isValidCl30OccurrenceToken('stable-token_1.abc'), isTrue);
      expect(isValidCl30OccurrenceToken('AbcDef12'), isTrue);
    });

    test('rejects too short or illegal characters', () {
      expect(isValidCl30OccurrenceToken('short'), isFalse);
      expect(isValidCl30OccurrenceToken('bad token!'), isFalse);
      expect(isValidCl30OccurrenceToken(''), isFalse);
      expect(
        isValidCl30OccurrenceToken('x' * 81),
        isFalse,
      );
    });
  });
}
