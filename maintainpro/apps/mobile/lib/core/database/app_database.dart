import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

/// Outbox lifecycle states for offline-first mutations.
enum OutboxState {
  localDraft,
  queued,
  syncing,
  synced,
  conflict,
  failedRetryable,
  failedPermanent,
}

extension OutboxStateCodec on OutboxState {
  String get wire {
    switch (this) {
      case OutboxState.localDraft:
        return 'LOCAL_DRAFT';
      case OutboxState.queued:
        return 'QUEUED';
      case OutboxState.syncing:
        return 'SYNCING';
      case OutboxState.synced:
        return 'SYNCED';
      case OutboxState.conflict:
        return 'CONFLICT';
      case OutboxState.failedRetryable:
        return 'FAILED_RETRYABLE';
      case OutboxState.failedPermanent:
        return 'FAILED_PERMANENT';
    }
  }

  static OutboxState parse(String raw) {
    switch (raw.toUpperCase()) {
      case 'LOCAL_DRAFT':
        return OutboxState.localDraft;
      case 'QUEUED':
        return OutboxState.queued;
      case 'SYNCING':
        return OutboxState.syncing;
      case 'SYNCED':
        return OutboxState.synced;
      case 'CONFLICT':
        return OutboxState.conflict;
      case 'FAILED_RETRYABLE':
        return OutboxState.failedRetryable;
      case 'FAILED_PERMANENT':
        return OutboxState.failedPermanent;
      default:
        return OutboxState.queued;
    }
  }
}

class OutboxOperations extends Table {
  TextColumn get operationId => text()();
  TextColumn get tenantId => text()();
  TextColumn get userId => text()();
  TextColumn get entityType => text()();
  TextColumn get entityId => text().nullable()();
  TextColumn get operation => text()();
  TextColumn get payloadHash => text()();
  TextColumn get idempotencyKey => text()();
  DateTimeColumn get createdAt => dateTime()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  TextColumn get state => text()();
  TextColumn get payloadJson => text()();

  @override
  Set<Column<Object>> get primaryKey => {operationId};
}

class LocalDrafts extends Table {
  TextColumn get draftId => text()();
  TextColumn get tenantId => text()();
  TextColumn get userId => text()();
  TextColumn get entityType => text()();
  TextColumn get entityId => text().nullable()();
  TextColumn get title => text().nullable()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {draftId};
}

class CacheEntries extends Table {
  TextColumn get cacheKey => text()();
  TextColumn get tenantId => text()();
  TextColumn get userId => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get fetchedAt => dateTime()();
  DateTimeColumn get expiresAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {cacheKey, tenantId, userId};
}

@DriftDatabase(tables: [OutboxOperations, LocalDrafts, CacheEntries])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  @override
  int get schemaVersion => 1;

  /// Opens the on-device SQLite database for MaintainPro Mobile V2.
  static AppDatabase connect() {
    return AppDatabase(LazyDatabase(() async {
      final dir = await getApplicationDocumentsDirectory();
      final file = File(p.join(dir.path, 'maintainpro_v2.sqlite'));
      return NativeDatabase.createInBackground(file);
    }));
  }

  Future<List<OutboxOperation>> pendingOutbox({
    required String tenantId,
    required String userId,
  }) {
    return (select(outboxOperations)
          ..where(
            (t) =>
                t.tenantId.equals(tenantId) &
                t.userId.equals(userId) &
                t.state.isIn([
                  OutboxState.queued.wire,
                  OutboxState.failedRetryable.wire,
                ]),
          )
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  Future<List<OutboxOperation>> outboxForUser({
    required String tenantId,
    required String userId,
  }) {
    return (select(outboxOperations)
          ..where(
            (t) => t.tenantId.equals(tenantId) & t.userId.equals(userId),
          )
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .get();
  }

  Future<List<LocalDraft>> draftsForUser({
    required String tenantId,
    required String userId,
  }) {
    return (select(localDrafts)
          ..where(
            (t) => t.tenantId.equals(tenantId) & t.userId.equals(userId),
          )
          ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)]))
        .get();
  }

  /// Removes all local rows for a user session (shared-device logout safety).
  Future<void> purgeUserLocalData({
    required String tenantId,
    required String userId,
  }) async {
    await (delete(outboxOperations)
          ..where(
            (t) => t.tenantId.equals(tenantId) & t.userId.equals(userId),
          ))
        .go();
    await (delete(localDrafts)
          ..where(
            (t) => t.tenantId.equals(tenantId) & t.userId.equals(userId),
          ))
        .go();
    await (delete(cacheEntries)
          ..where(
            (t) => t.tenantId.equals(tenantId) & t.userId.equals(userId),
          ))
        .go();
  }

  /// Clears all on-device offline data (full logout on shared tablets).
  Future<void> purgeAllLocalData() async {
    await delete(outboxOperations).go();
    await delete(localDrafts).go();
    await delete(cacheEntries).go();
  }
}

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase.connect();
  ref.onDispose(db.close);
  return db;
});
