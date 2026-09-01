import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/database/app_database.dart';

void main() {
  late AppDatabase db;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
  });

  tearDown(() async {
    await db.close();
  });

  test('purgeUserLocalData removes only scoped user rows', () async {
    await db.into(db.outboxOperations).insert(
          OutboxOperationsCompanion.insert(
            operationId: 'op-a',
            tenantId: 't1',
            userId: 'u1',
            entityType: 'work_order',
            operation: 'note',
            payloadHash: 'h1',
            idempotencyKey: 'k1',
            createdAt: DateTime.utc(2026, 1, 1),
            state: 'QUEUED',
            payloadJson: '{}',
          ),
        );
    await db.into(db.outboxOperations).insert(
          OutboxOperationsCompanion.insert(
            operationId: 'op-b',
            tenantId: 't1',
            userId: 'u2',
            entityType: 'work_order',
            operation: 'note',
            payloadHash: 'h2',
            idempotencyKey: 'k2',
            createdAt: DateTime.utc(2026, 1, 1),
            state: 'QUEUED',
            payloadJson: '{}',
          ),
        );
    await db.into(db.localDrafts).insert(
          LocalDraftsCompanion.insert(
            draftId: 'd-a',
            tenantId: 't1',
            userId: 'u1',
            entityType: 'fg',
            payloadJson: '{}',
            updatedAt: DateTime.utc(2026, 1, 1),
          ),
        );

    await db.purgeUserLocalData(tenantId: 't1', userId: 'u1');

    final remainingOutbox = await db.outboxForUser(tenantId: 't1', userId: 'u2');
    final user1Drafts = await db.draftsForUser(tenantId: 't1', userId: 'u1');
    expect(remainingOutbox.length, 1);
    expect(remainingOutbox.first.operationId, 'op-b');
    expect(user1Drafts, isEmpty);
  });

  test('purgeAllLocalData clears every local table', () async {
    await db.into(db.localDrafts).insert(
          LocalDraftsCompanion.insert(
            draftId: 'd1',
            tenantId: 't1',
            userId: 'u1',
            entityType: 'fg',
            payloadJson: '{}',
            updatedAt: DateTime.utc(2026, 1, 1),
          ),
        );
    await db.purgeAllLocalData();
    final drafts = await db.draftsForUser(tenantId: 't1', userId: 'u1');
    expect(drafts, isEmpty);
  });
}
