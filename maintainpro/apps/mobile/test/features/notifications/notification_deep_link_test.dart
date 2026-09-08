import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/features/notifications/notification_deep_link.dart';

void main() {
  group('resolveNotificationDeepLink', () {
    test('maps work order web link with highlight', () {
      expect(
        resolveNotificationDeepLink(
          deepLink: '/work-orders?highlight=wo-123',
        ),
        '/work-orders/wo-123',
      );
    });

    test('maps vehicle reference', () {
      expect(
        resolveNotificationDeepLink(
          referenceType: 'Vehicle',
          referenceId: 'v-1',
        ),
        '/fleet/vehicles/v-1',
      );
    });

    test('maps facility issue query param', () {
      expect(
        resolveNotificationDeepLink(
          deepLink: '/cleaning/issues?issueId=fi-9',
        ),
        '/facilities/issues/fi-9',
      );
    });

    test('returns null for unknown reference', () {
      expect(
        resolveNotificationDeepLink(
          referenceType: 'UnknownEntity',
          referenceId: 'x',
        ),
        isNull,
      );
    });
  });
}
