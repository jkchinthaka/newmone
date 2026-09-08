import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_endpoints.dart';
import '../network/connectivity_provider.dart';
import '../network/dio_client.dart';
import '../network/network_exceptions.dart';
import 'offline_queue.dart';

const offlineActionKindFuelLog = 'FUEL_LOG_CREATE';
const offlineActionKindWorkOrderStatus = 'WORK_ORDER_STATUS_UPDATE';

enum OfflineSubmissionDisposition { synced, queued, duplicateQueued }

class OfflineSubmissionResult {
  const OfflineSubmissionResult({
    required this.disposition,
    this.action,
  });

  final OfflineSubmissionDisposition disposition;
  final OfflineAction? action;

  bool get isSynced => disposition == OfflineSubmissionDisposition.synced;
  bool get isQueued => disposition != OfflineSubmissionDisposition.synced;
  bool get isDuplicate =>
      disposition == OfflineSubmissionDisposition.duplicateQueued;
}

class OfflineReplayResult {
  const OfflineReplayResult({
    this.replayedCount = 0,
    this.failedCount = 0,
  });

  final int replayedCount;
  final int failedCount;
}

class OfflineSyncState {
  const OfflineSyncState({
    this.replaying = false,
    this.lastReplayAt,
    this.lastError,
    this.lastReplayedCount = 0,
  });

  final bool replaying;
  final DateTime? lastReplayAt;
  final String? lastError;
  final int lastReplayedCount;

  OfflineSyncState copyWith({
    bool? replaying,
    Object? lastReplayAt = _offlineSyncSentinel,
    Object? lastError = _offlineSyncSentinel,
    int? lastReplayedCount,
  }) {
    return OfflineSyncState(
      replaying: replaying ?? this.replaying,
      lastReplayAt: identical(lastReplayAt, _offlineSyncSentinel)
          ? this.lastReplayAt
          : lastReplayAt as DateTime?,
      lastError: identical(lastError, _offlineSyncSentinel)
          ? this.lastError
          : lastError as String?,
      lastReplayedCount: lastReplayedCount ?? this.lastReplayedCount,
    );
  }
}

const _offlineSyncSentinel = Object();

final offlineQueueRevisionProvider = StateProvider<int>((_) => 0);

final offlineQueueStatsProvider = FutureProvider<OfflineQueueStats>((ref) async {
  ref.watch(offlineQueueRevisionProvider);
  return ref.read(offlineQueueProvider).stats();
});

final offlineSyncStateProvider =
    StateProvider<OfflineSyncState>((_) => const OfflineSyncState());

final offlineSyncControllerProvider = Provider<OfflineSyncController>((ref) {
  return OfflineSyncController(
    ref,
    ref.watch(offlineQueueProvider),
    ref.watch(dioProvider),
  );
});

class OfflineSyncController {
  OfflineSyncController(this._ref, this._queue, this._dio);

  final Ref _ref;
  final OfflineQueue _queue;
  final Dio _dio;

  Future<OfflineReplayResult>? _activeReplay;

  Future<OfflineSubmissionResult> submitFuelLog(
    String vehicleId, {
    String? driverId,
    required double liters,
    required double costPerLiter,
    required double mileageAtFuel,
    String? fuelStation,
    String? notes,
  }) {
    final payload = <String, dynamic>{
      if (driverId != null && driverId.isNotEmpty) 'driverId': driverId,
      'liters': liters,
      'costPerLiter': costPerLiter,
      'mileageAtFuel': mileageAtFuel,
      if (fuelStation != null && fuelStation.isNotEmpty)
        'fuelStation': fuelStation,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };

    return _submitOrQueue(
      kind: offlineActionKindFuelLog,
      method: 'POST',
      path: ApiEndpoints.vehicleFuelLog(vehicleId),
      payload: payload,
      dedupeKey: _buildDedupeKey(
        offlineActionKindFuelLog,
        [
          vehicleId,
          driverId,
          liters,
          costPerLiter,
          mileageAtFuel,
          fuelStation,
          notes,
        ],
      ),
    );
  }

  Future<OfflineSubmissionResult> submitWorkOrderStatus(
    String workOrderId, {
    required String status,
    num? actualCost,
    num? actualHours,
  }) {
    final payload = <String, dynamic>{
      'status': status,
      if (actualCost != null) 'actualCost': actualCost,
      if (actualHours != null) 'actualHours': actualHours,
    };

    return _submitOrQueue(
      kind: offlineActionKindWorkOrderStatus,
      method: 'PATCH',
      path: ApiEndpoints.workOrderStatus(workOrderId),
      payload: payload,
      dedupeKey: _buildDedupeKey(
        offlineActionKindWorkOrderStatus,
        [workOrderId, status, actualCost, actualHours],
      ),
    );
  }

  Future<OfflineReplayResult> replayPending() {
    if (!_ref.read(isOnlineProvider)) {
      return Future.value(const OfflineReplayResult());
    }

    final activeReplay = _activeReplay;
    if (activeReplay != null) {
      return activeReplay;
    }

    final future = _runReplay();
    _activeReplay = future;
    return future;
  }

  Future<OfflineReplayResult> _runReplay() async {
    _setSyncState(
      _ref.read(offlineSyncStateProvider).copyWith(
            replaying: true,
            lastError: null,
          ),
    );

    try {
      final replayed = await _queue.replay(
        _executeQueuedAction,
        includeFailed: true,
        stopOnError: true,
      );
      _touchQueue();
      final stats = await _queue.stats();
      final result = OfflineReplayResult(
        replayedCount: replayed.length,
        failedCount: stats.failed,
      );
      _setSyncState(
        _ref.read(offlineSyncStateProvider).copyWith(
              replaying: false,
              lastReplayAt: DateTime.now().toUtc(),
              lastError: null,
              lastReplayedCount: replayed.length,
            ),
      );
      return result;
    } catch (error) {
      _touchQueue();
      _setSyncState(
        _ref.read(offlineSyncStateProvider).copyWith(
              replaying: false,
              lastError: error.toString(),
            ),
      );
      rethrow;
    } finally {
      _activeReplay = null;
    }
  }

  Future<OfflineSubmissionResult> _submitOrQueue({
    required String kind,
    required String method,
    required String path,
    required Map<String, dynamic> payload,
    String? dedupeKey,
  }) async {
    final normalizedDedupeKey = dedupeKey?.trim();
    if (normalizedDedupeKey != null && normalizedDedupeKey.isNotEmpty) {
      final existing = await _queue.findByDedupeKey(normalizedDedupeKey);
      if (existing != null) {
        return OfflineSubmissionResult(
          disposition: OfflineSubmissionDisposition.duplicateQueued,
          action: existing,
        );
      }
    }

    if (_ref.read(isOnlineProvider)) {
      try {
        await _sendRequest(method: method, path: path, payload: payload);
        return const OfflineSubmissionResult(
          disposition: OfflineSubmissionDisposition.synced,
        );
      } on DioException catch (error) {
        final networkError = NetworkException.fromDio(error);
        if (!_shouldQueue(networkError)) {
          throw networkError;
        }
      }
    }

    final action = await _queue.add(
      kind: kind,
      method: method,
      path: path,
      payload: payload,
      dedupeKey: normalizedDedupeKey,
    );
    _touchQueue();

    return OfflineSubmissionResult(
      disposition: OfflineSubmissionDisposition.queued,
      action: action,
    );
  }

  Future<void> _executeQueuedAction(OfflineAction action) async {
    try {
      await _sendRequest(
        method: action.method,
        path: action.path,
        payload: action.payload,
      );
    } on DioException catch (error) {
      throw NetworkException.fromDio(error);
    }
  }

  Future<void> _sendRequest({
    required String method,
    required String path,
    required Map<String, dynamic> payload,
  }) async {
    switch (method.trim().toUpperCase()) {
      case 'POST':
        await _dio.post<dynamic>(path, data: payload);
        return;
      case 'PATCH':
        await _dio.patch<dynamic>(path, data: payload);
        return;
      case 'PUT':
        await _dio.put<dynamic>(path, data: payload);
        return;
      case 'DELETE':
        await _dio.delete<dynamic>(path, data: payload.isEmpty ? null : payload);
        return;
      default:
        throw UnsupportedError('Unsupported offline method: $method');
    }
  }

  bool _shouldQueue(NetworkException error) {
    return error is NoConnectionException || error is TimeoutException;
  }

  String _buildDedupeKey(String prefix, List<Object?> values) {
    return [prefix, ...values.map(_normalizeValue)].join(':');
  }

  String _normalizeValue(Object? value) {
    if (value == null) {
      return '';
    }
    if (value is DateTime) {
      return value.toUtc().toIso8601String();
    }

    return value.toString().trim().toLowerCase();
  }

  void _touchQueue() {
    _ref.read(offlineQueueRevisionProvider.notifier).state++;
  }

  void _setSyncState(OfflineSyncState state) {
    _ref.read(offlineSyncStateProvider.notifier).state = state;
  }
}