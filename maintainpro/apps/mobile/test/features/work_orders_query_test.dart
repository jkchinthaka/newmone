import 'package:flutter_test/flutter_test.dart';

import 'package:maintainpro_mobile/features/work_orders/data/work_orders_repository.dart';

void main() {
  group('WorkOrdersListQuery', () {
    test('equality considers queue search status', () {
      const a = WorkOrdersListQuery(queue: 'my-tasks', search: 'pump');
      const b = WorkOrdersListQuery(queue: 'my-tasks', search: 'pump');
      const c = WorkOrdersListQuery(queue: 'waiting-parts', search: 'pump');
      expect(a, equals(b));
      expect(a, isNot(equals(c)));
    });
  });

  group('WorkOrderQueueKeys', () {
    test('matches Nest queue path segments', () {
      expect(WorkOrderQueueKeys.myTasks, 'my-tasks');
      expect(WorkOrderQueueKeys.waitingEvidence, 'waiting-evidence');
      expect(WorkOrderQueueKeys.supervisorVerification, 'supervisor-verification');
    });
  });
}
