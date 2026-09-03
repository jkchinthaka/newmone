import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/work_orders/data/evidence_upload_service.dart';
import '../auth/auth_controller.dart';
import '../database/app_database.dart';
import '../network/api_exception.dart';
import '../network/dio_client.dart';
import '../tenant/tenant_context.dart';
import 'outbox_service.dart';
import 'sync_failure.dart';

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

/// Drains the durable outbox when online.
///
/// Pilot-safe handlers: work_order status/note. Evidence drafts are drained via
/// [EvidenceUploadService.retryAllPending] (file-backed, not outbox JSON).
class SyncController extends StateNotifier<SyncStatus> {
  SyncController(
    this._ref, {
    SyncFailureClassifier? classifier,
    Future<List<ConnectivityResult>> Function()? checkConnectivity,
    Stream<List<ConnectivityResult>>? connectivityChanges,
  })  : _classifier = classifier ?? const SyncFailureClassifier(),
        _checkConnectivity = checkConnectivity ??
            (() => Connectivity().checkConnectivity()),
        super(SyncStatus.idle) {
    _connectivitySub = (connectivityChanges ??
            Connectivity().onConnectivityChanged)
        .listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) {
        unawaited(syncNow());
      } else {
        state = state.copyWith(phase: SyncPhase.offline, message: 'Offline');
      }
    });
  }

  final Ref _ref;
  final SyncFailureClassifier _classifier;
  final Future<List<ConnectivityResult>> Function() _checkConnectivity;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  bool _running = false;

  static const maxAttempts = 8;

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
    final evidencePending =
        await _ref.read(evidenceUploadServiceProvider).listAllPending();
    state = state.copyWith(
      pendingCount: pending.length + evidencePending.length,
    );
  }

  Future<void> syncNow() async {
    if (_running) return;
    final auth = _ref.read(authControllerProvider);
    final tenant = _ref.read(tenantContextProvider);
    final user = auth.user;
    final tenantId = tenant.tenantId;
    if (!auth.isAuthenticated || user == null || tenantId == null) return;

    final connectivity = await _checkConnectivity();
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
        if (op.attempts >= maxAttempts) {
          await _outbox.updateState(
            operationId: op.operationId,
            state: OutboxState.failedPermanent,
            lastError: 'Exceeded max sync attempts ($maxAttempts)',
          );
          continue;
        }

        // Simple backoff based on prior attempts (0, 250, 500, 1000…).
        if (op.attempts > 0) {
          final delayMs = (250 * (1 << (op.attempts - 1).clamp(0, 5)));
          await Future<void>.delayed(Duration(milliseconds: delayMs));
        }

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
          final permanent = _classifier.isPermanent(e);
          await _outbox.updateState(
            operationId: op.operationId,
            state: permanent
                ? OutboxState.failedPermanent
                : OutboxState.failedRetryable,
            lastError: _safeError(e),
            incrementAttempts: true,
          );
        }
      }

      // Drain file-backed evidence drafts (not outbox JSON).
      try {
        await _ref.read(evidenceUploadServiceProvider).retryAllPending();
      } catch (e) {
        // Evidence failures stay on the draft; do not fail the whole sync pass.
        state = state.copyWith(
          message: 'Evidence sync: ${_safeError(e)}',
        );
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
        message: _safeError(e),
      );
    } finally {
      _running = false;
    }
  }

  String _safeError(Object error) {
    if (error is ApiException) return error.message;
    final text = error.toString();
    return text.length > 240 ? '${text.substring(0, 240)}…' : text;
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
        throw SyncPermanentException('No sync handler for ${op.entityType}');
    }
  }

  Future<void> _syncWorkOrder(
    OutboxOperation op,
    Map<String, dynamic> data,
  ) async {
    final headers = <String, dynamic>{
      'Idempotency-Key': op.idempotencyKey,
    };
    try {
      switch (op.operation) {
        case 'status':
          final id = op.entityId ?? data['id']?.toString();
          if (id == null || id.isEmpty) {
            throw SyncPermanentException('work_order status missing entityId');
          }
          await _dio.patch<dynamic>(
            '/work-orders/$id/status',
            data: {
              'status': data['status'],
              if (data['extra'] is Map) ...Map<String, dynamic>.from(data['extra'] as Map),
            },
            options: Options(headers: headers),
          );
        case 'note':
          final id = op.entityId ?? data['workOrderId']?.toString();
          final note = data['note']?.toString() ?? '';
          if (id == null || id.isEmpty) {
            throw SyncPermanentException('work_order note missing entityId');
          }
          if (note.trim().isEmpty) {
            throw SyncPermanentException('work_order note is empty');
          }
          await _dio.post<dynamic>(
            '/work-orders/$id/notes',
            data: {'note': note},
            options: Options(headers: headers),
          );
        case 'create':
          await _dio.post<dynamic>(
            '/work-orders',
            data: data,
            options: Options(headers: headers),
          );
        default:
          throw SyncPermanentException(
            'Unsupported work_order operation: ${op.operation}',
          );
      }
    } on DioException catch (e) {
      throwApiException(e);
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
