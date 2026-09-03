import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../auth/auth_controller.dart';
import '../database/app_database.dart';
import '../tenant/tenant_context.dart';

/// Enqueues offline mutations with idempotency keys.
///
/// Drift-backed Phase 1 foundation. Swap storage later without changing callers.
class OutboxService {
  OutboxService(this._db);

  final AppDatabase _db;
  final _uuid = const Uuid();

  Future<String> enqueue({
    required String tenantId,
    required String userId,
    required String entityType,
    required String operation,
    required Map<String, dynamic> payload,
    String? entityId,
    String? idempotencyKey,
    OutboxState initialState = OutboxState.queued,
  }) async {
    final id = _uuid.v4();
    final key = idempotencyKey ?? _uuid.v4();
    final json = jsonEncode(payload);
    final hash = sha256.convert(utf8.encode(json)).toString();

    await _db.into(_db.outboxOperations).insert(
          OutboxOperationsCompanion.insert(
            operationId: id,
            tenantId: tenantId,
            userId: userId,
            entityType: entityType,
            entityId: Value(entityId),
            operation: operation,
            payloadHash: hash,
            idempotencyKey: key,
            createdAt: DateTime.now().toUtc(),
            state: initialState.wire,
            payloadJson: json,
          ),
        );
    return id;
  }

  /// Enqueues only when no matching pending/retryable/syncing op exists.
  ///
  /// Dedupes by tenant+user+entityType+operation+entityId+payloadHash so
  /// repeated taps do not create duplicate server writes after reconnect.
  Future<String> enqueueIfAbsent({
    required String tenantId,
    required String userId,
    required String entityType,
    required String operation,
    required Map<String, dynamic> payload,
    String? entityId,
    String? idempotencyKey,
  }) async {
    final json = jsonEncode(payload);
    final hash = sha256.convert(utf8.encode(json)).toString();
    final existing = await (_db.select(_db.outboxOperations)
          ..where(
            (t) =>
                t.tenantId.equals(tenantId) &
                t.userId.equals(userId) &
                t.entityType.equals(entityType) &
                t.operation.equals(operation) &
                t.payloadHash.equals(hash) &
                t.state.isIn([
                  OutboxState.queued.wire,
                  OutboxState.syncing.wire,
                  OutboxState.failedRetryable.wire,
                ]),
          ))
        .get();

    if (entityId != null && entityId.isNotEmpty) {
      final sameEntity = existing.where((o) => o.entityId == entityId);
      if (sameEntity.isNotEmpty) {
        return sameEntity.first.operationId;
      }
    } else if (existing.isNotEmpty) {
      return existing.first.operationId;
    }

    return enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: entityType,
      operation: operation,
      payload: payload,
      entityId: entityId,
      idempotencyKey: idempotencyKey,
    );
  }

  Future<void> updateState({
    required String operationId,
    required OutboxState state,
    String? lastError,
    bool incrementAttempts = false,
  }) async {
    final existing = await (_db.select(_db.outboxOperations)
          ..where((t) => t.operationId.equals(operationId)))
        .getSingleOrNull();
    if (existing == null) return;

    await (_db.update(_db.outboxOperations)
          ..where((t) => t.operationId.equals(operationId)))
        .write(
      OutboxOperationsCompanion(
        state: Value(state.wire),
        lastError: Value(lastError),
        attempts: incrementAttempts
            ? Value(existing.attempts + 1)
            : const Value.absent(),
      ),
    );
  }

  Future<List<OutboxOperation>> listPending({
    required String tenantId,
    required String userId,
  }) {
    return _db.pendingOutbox(tenantId: tenantId, userId: userId);
  }

  Future<List<OutboxOperation>> listAll({
    required String tenantId,
    required String userId,
  }) {
    return _db.outboxForUser(tenantId: tenantId, userId: userId);
  }

  Future<void> saveDraft({
    required String tenantId,
    required String userId,
    required String entityType,
    required Map<String, dynamic> payload,
    String? draftId,
    String? entityId,
    String? title,
  }) async {
    final id = draftId ?? _uuid.v4();
    await _db.into(_db.localDrafts).insertOnConflictUpdate(
          LocalDraftsCompanion.insert(
            draftId: id,
            tenantId: tenantId,
            userId: userId,
            entityType: entityType,
            entityId: Value(entityId),
            title: Value(title),
            payloadJson: jsonEncode(payload),
            updatedAt: DateTime.now().toUtc(),
          ),
        );
  }

  Future<List<LocalDraft>> listDrafts({
    required String tenantId,
    required String userId,
  }) {
    return _db.draftsForUser(tenantId: tenantId, userId: userId);
  }

  Future<void> deleteDraft(String draftId) async {
    await (_db.delete(_db.localDrafts)
          ..where((t) => t.draftId.equals(draftId)))
        .go();
  }
}

final outboxServiceProvider = Provider<OutboxService>((ref) {
  return OutboxService(ref.watch(appDatabaseProvider));
});

/// Convenience provider that scopes outbox to the active session.
final scopedOutboxProvider = Provider<OutboxService?>((ref) {
  final auth = ref.watch(authControllerProvider);
  final tenant = ref.watch(tenantContextProvider);
  if (!auth.isAuthenticated || !tenant.hasTenant) return null;
  return ref.watch(outboxServiceProvider);
});
