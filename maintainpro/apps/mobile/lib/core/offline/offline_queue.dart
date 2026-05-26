import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

final offlineQueueProvider = Provider<OfflineQueue>((_) => OfflineQueue());

typedef OfflineActionExecutor = Future<void> Function(OfflineAction action);

enum OfflineActionStatus { pending, inFlight, failed }

extension OfflineActionStatusCodec on OfflineActionStatus {
  String get value {
    switch (this) {
      case OfflineActionStatus.pending:
        return 'PENDING';
      case OfflineActionStatus.inFlight:
        return 'IN_FLIGHT';
      case OfflineActionStatus.failed:
        return 'FAILED';
    }
  }

  static OfflineActionStatus fromJson(String? raw) {
    switch ((raw ?? '').trim().toUpperCase()) {
      case 'IN_FLIGHT':
        return OfflineActionStatus.inFlight;
      case 'FAILED':
        return OfflineActionStatus.failed;
      default:
        return OfflineActionStatus.pending;
    }
  }
}

class OfflineAction {
  OfflineAction({
    required this.id,
    required this.kind,
    required this.path,
    required this.method,
    required this.payload,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.dedupeKey,
    this.attempts = 0,
    this.lastAttemptAt,
    this.lastError,
  });

  final String id;
  final String kind;
  final String path;
  final String method;
  final Map<String, dynamic> payload;
  final OfflineActionStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? dedupeKey;
  final int attempts;
  final DateTime? lastAttemptAt;
  final String? lastError;

  OfflineAction copyWith({
    String? id,
    String? kind,
    String? path,
    String? method,
    Map<String, dynamic>? payload,
    OfflineActionStatus? status,
    DateTime? createdAt,
    DateTime? updatedAt,
    Object? dedupeKey = _offlineQueueSentinel,
    int? attempts,
    Object? lastAttemptAt = _offlineQueueSentinel,
    Object? lastError = _offlineQueueSentinel,
  }) {
    return OfflineAction(
      id: id ?? this.id,
      kind: kind ?? this.kind,
      path: path ?? this.path,
      method: method ?? this.method,
      payload: payload ?? this.payload,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      dedupeKey: identical(dedupeKey, _offlineQueueSentinel)
          ? this.dedupeKey
          : dedupeKey as String?,
      attempts: attempts ?? this.attempts,
      lastAttemptAt: identical(lastAttemptAt, _offlineQueueSentinel)
          ? this.lastAttemptAt
          : lastAttemptAt as DateTime?,
      lastError: identical(lastError, _offlineQueueSentinel)
          ? this.lastError
          : lastError as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind,
        'path': path,
        'method': method,
        'payload': payload,
        'status': status.value,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
        'dedupeKey': dedupeKey,
        'attempts': attempts,
        'lastAttemptAt': lastAttemptAt?.toIso8601String(),
        'lastError': lastError,
      };

  static OfflineAction fromJson(Map<String, dynamic> json) {
    return OfflineAction(
      id: json['id'] as String,
      kind: (json['kind'] as String?) ?? 'GENERIC',
      path: json['path'] as String,
      method: json['method'] as String,
      payload: Map<String, dynamic>.from(json['payload'] as Map),
      status: OfflineActionStatusCodec.fromJson(json['status'] as String?),
      createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '')
              ?.toUtc() ??
          DateTime.now().toUtc(),
      updatedAt: DateTime.tryParse((json['updatedAt'] as String?) ?? '')
              ?.toUtc() ??
          DateTime.now().toUtc(),
      dedupeKey: json['dedupeKey'] as String?,
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      lastAttemptAt:
          DateTime.tryParse((json['lastAttemptAt'] as String?) ?? '')?.toUtc(),
      lastError: json['lastError'] as String?,
    );
  }
}

class OfflineQueueStats {
  const OfflineQueueStats({
    this.pending = 0,
    this.inFlight = 0,
    this.failed = 0,
  });

  final int pending;
  final int inFlight;
  final int failed;

  int get total => pending + inFlight + failed;
}

const _offlineQueueSentinel = Object();

class OfflineQueue {
  static const _boxName = 'offlineQueueBox';
  final Uuid _uuid = const Uuid();

  Future<OfflineAction> add({
    required String kind,
    required String path,
    required String method,
    required Map<String, dynamic> payload,
    String? dedupeKey,
  }) async {
    final box = await _openBox();
    final normalizedDedupeKey = dedupeKey?.trim();

    if (normalizedDedupeKey != null && normalizedDedupeKey.isNotEmpty) {
      final existing = await findByDedupeKey(normalizedDedupeKey);
      if (existing != null) {
        return existing;
      }
    }

    final now = DateTime.now().toUtc();
    final action = OfflineAction(
      id: _uuid.v4(),
      kind: kind,
      path: path,
      method: method,
      payload: payload,
      status: OfflineActionStatus.pending,
      createdAt: now,
      updatedAt: now,
      dedupeKey: normalizedDedupeKey,
    );

    await box.put(action.id, jsonEncode(action.toJson()));
    return action;
  }

  Future<List<OfflineAction>> list({Set<OfflineActionStatus>? statuses}) async {
    final box = await _openBox();
    return box.values
        .map(_decodeAction)
        .where((action) => statuses == null || statuses.contains(action.status))
        .toList()
      ..sort((left, right) => left.createdAt.compareTo(right.createdAt));
  }

  Future<OfflineAction?> getById(String id) async {
    final box = await _openBox();
    final raw = box.get(id);
    if (raw is! String) {
      return null;
    }

    return _decodeAction(raw);
  }

  Future<OfflineAction?> findByDedupeKey(String dedupeKey) async {
    final normalized = dedupeKey.trim();
    if (normalized.isEmpty) {
      return null;
    }

    final actions = await list();
    for (final action in actions) {
      if (action.dedupeKey == normalized) {
        return action;
      }
    }

    return null;
  }

  Future<OfflineQueueStats> stats() async {
    final actions = await list();
    int pending = 0;
    int inFlight = 0;
    int failed = 0;

    for (final action in actions) {
      switch (action.status) {
        case OfflineActionStatus.pending:
          pending += 1;
          break;
        case OfflineActionStatus.inFlight:
          inFlight += 1;
          break;
        case OfflineActionStatus.failed:
          failed += 1;
          break;
      }
    }

    return OfflineQueueStats(
      pending: pending,
      inFlight: inFlight,
      failed: failed,
    );
  }

  Future<OfflineAction?> markInFlight(String id) {
    return _update(id, (action) => action.copyWith(
          status: OfflineActionStatus.inFlight,
          updatedAt: DateTime.now().toUtc(),
          attempts: action.attempts + 1,
          lastAttemptAt: DateTime.now().toUtc(),
          lastError: null,
        ));
  }

  Future<OfflineAction?> markFailed(String id, {String? error}) {
    return _update(id, (action) => action.copyWith(
          status: OfflineActionStatus.failed,
          updatedAt: DateTime.now().toUtc(),
          lastError: error,
        ));
  }

  Future<OfflineAction?> markPending(String id) {
    return _update(id, (action) => action.copyWith(
          status: OfflineActionStatus.pending,
          updatedAt: DateTime.now().toUtc(),
        ));
  }

  Future<void> remove(String id) async {
    final box = await _openBox();
    await box.delete(id);
  }

  Future<List<OfflineAction>> replay(
    OfflineActionExecutor executor, {
    int maxItems = 50,
    bool includeFailed = true,
    bool stopOnError = true,
  }) async {
    final statuses = <OfflineActionStatus>{OfflineActionStatus.pending};
    if (includeFailed) {
      statuses.add(OfflineActionStatus.failed);
    }

    final queued = await list(statuses: statuses);
    final replayed = <OfflineAction>[];

    for (final action in queued.take(maxItems)) {
      final inFlight = await markInFlight(action.id);
      if (inFlight == null) {
        continue;
      }

      try {
        await executor(inFlight);
        await remove(inFlight.id);
        replayed.add(inFlight);
      } catch (error) {
        await markFailed(inFlight.id, error: _messageForError(error));
        if (stopOnError) {
          break;
        }
      }
    }

    return replayed;
  }

  Future<void> clearByStatus(Set<OfflineActionStatus> statuses) async {
    final actions = await list(statuses: statuses);
    final box = await _openBox();
    for (final action in actions) {
      await box.delete(action.id);
    }
  }

  Future<OfflineAction?> _update(
    String id,
    OfflineAction Function(OfflineAction action) updater,
  ) async {
    final current = await getById(id);
    if (current == null) {
      return null;
    }

    final next = updater(current);
    final box = await _openBox();
    await box.put(next.id, jsonEncode(next.toJson()));
    return next;
  }

  OfflineAction _decodeAction(dynamic item) {
    return OfflineAction.fromJson(
      jsonDecode(item as String) as Map<String, dynamic>,
    );
  }

  String _messageForError(Object error) {
    final text = error.toString().trim();
    if (text.isEmpty) {
      return 'Unknown offline replay error';
    }

    return text;
  }

  Future<Box<dynamic>> _openBox() async {
    if (Hive.isBoxOpen(_boxName)) {
      return Hive.box<dynamic>(_boxName);
    }

    return Hive.openBox<dynamic>(_boxName);
  }

  Future<void> clear() async {
    final box = await _openBox();
    await box.clear();
  }
}
