import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../database/app_database.dart';
import '../network/dio_client.dart';
import '../tenant/tenant_context.dart';
import 'outbox_service.dart';

enum SyncPhase { idle, checking, syncing, offline, error }

class SyncStatus {
  const SyncStatus({
    required this.phase,
    this.pendingCount = 0,
    this.lastSyncedAt,
    this.message,
  });

  final SyncPhase phase;
  final int pendingCount;
  final DateTime? lastSyncedAt;
  final String? message;

  SyncStatus copyWith({
    SyncPhase? phase,
    int? pendingCount,
    DateTime? lastSyncedAt,
    String? message,
  }) {
    return SyncStatus(
      phase: phase ?? this.phase,
      pendingCount: pendingCount ?? this.pendingCount,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      message: message,
    );
  }

  static const idle = SyncStatus(phase: SyncPhase.idle);
}

/// Drains the outbox when online. Entity handlers are registered by feature modules.
class SyncController extends StateNotifier<SyncStatus> {
  SyncController(this._ref) : super(SyncStatus.idle) {
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) {
        unawaited(syncNow());
      } else {
        state = state.copyWith(phase: SyncPhase.offline, message: 'Offline');
      }
    });
  }

  final Ref _ref;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  bool _running = false;

  OutboxService get _outbox => _ref.read(outboxServiceProvider);
  Dio get _dio => _ref.read(dioProvider);

  Future<void> refreshCounts() async {
    final auth = _ref.read(authControllerProvider);
    final tenant = _ref.read(tenantContextProvider);
    final user = auth.user;
    final tenantId = tenant.tenantId;
    if (user == null || tenantId == null) {
      state = state.copyWith(pendingCount: 0);
      return;
    }
    final pending = await _outbox.listPending(
      tenantId: tenantId,
      userId: user.id,
    );
    state = state.copyWith(pendingCount: pending.length);
  }

  Future<void> syncNow() async {
    if (_running) return;
    final auth = _ref.read(authControllerProvider);
    final tenant = _ref.read(tenantContextProvider);
    final user = auth.user;
    final tenantId = tenant.tenantId;
    if (!auth.isAuthenticated || user == null || tenantId == null) return;

    final connectivity = await Connectivity().checkConnectivity();
    final online = connectivity.any((r) => r != ConnectivityResult.none);
    if (!online) {
      state = state.copyWith(phase: SyncPhase.offline, message: 'Offline');
      await refreshCounts();
      return;
    }

    _running = true;
    state = state.copyWith(phase: SyncPhase.syncing, message: 'Syncing…');
    try {
      final pending = await _outbox.listPending(
        tenantId: tenantId,
        userId: user.id,
      );
      for (final op in pending) {
        await _outbox.updateState(
          operationId: op.operationId,
          state: OutboxState.syncing,
        );
        try {
          await _dispatch(op);
          await _outbox.updateState(
            operationId: op.operationId,
            state: OutboxState.synced,
          );
        } catch (e) {
          await _outbox.updateState(
            operationId: op.operationId,
            state: OutboxState.failedRetryable,
            lastError: e.toString(),
            incrementAttempts: true,
          );
        }
      }
      state = state.copyWith(
        phase: SyncPhase.idle,
        lastSyncedAt: DateTime.now(),
        message: 'Up to date',
      );
      await refreshCounts();
    } catch (e) {
      state = state.copyWith(
        phase: SyncPhase.error,
        message: e.toString(),
      );
    } finally {
      _running = false;
    }
  }

  Future<void> _dispatch(OutboxOperation op) async {
    final payload = jsonDecode(op.payloadJson);
    final data = payload is Map<String, dynamic>
        ? payload
        : Map<String, dynamic>.from(payload as Map);

    switch (op.entityType) {
      case 'work_order':
        await _syncWorkOrder(op, data);
      default:
        // Unknown entity — mark permanent so it does not block the queue forever.
        await _outbox.updateState(
          operationId: op.operationId,
          state: OutboxState.failedPermanent,
          lastError: 'No sync handler for ${op.entityType}',
        );
    }
  }

  Future<void> _syncWorkOrder(
    OutboxOperation op,
    Map<String, dynamic> data,
  ) async {
    final headers = <String, dynamic>{
      'Idempotency-Key': op.idempotencyKey,
    };
    switch (op.operation) {
      case 'status':
        final id = op.entityId ?? data['id']?.toString();
        if (id == null) {
          throw StateError('work_order status missing entityId');
        }
        await _dio.patch<dynamic>(
          '/work-orders/$id/status',
          data: data,
          options: Options(headers: headers),
        );
      case 'create':
        await _dio.post<dynamic>(
          '/work-orders',
          data: data,
          options: Options(headers: headers),
        );
      default:
        throw StateError('Unsupported work_order operation: ${op.operation}');
    }
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    super.dispose();
  }
}

final syncControllerProvider =
    StateNotifierProvider<SyncController, SyncStatus>((ref) {
  return SyncController(ref);
});
