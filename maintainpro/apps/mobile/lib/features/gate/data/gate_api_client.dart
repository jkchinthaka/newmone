import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'gate_models.dart';

/// Nest client for `/vehicles` gate In/Out.
///
/// Gate mutations are online-only — never queue to outbox.
/// Always send [Idempotency-Key] header; never send `approvedByUserId`
/// (server uses authenticated actor) or Security-authored `occurredAt`.
class GateApiClient {
  GateApiClient(this._dio);

  final Dio _dio;

  static const _base = '/vehicles';

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<List<VehicleSummary>> searchVehicles(String q) => _guarded(() async {
        final res = await _dio.get<dynamic>(
          _base,
          queryParameters: {
            if (q.trim().isNotEmpty) 'q': q.trim(),
            'pageSize': 20,
          },
        );
        final data = unwrapGateData(res.data);
        return extractVehicleList(data).map(VehicleSummary.fromJson).toList();
      });

  Future<VehicleSummary> getVehicle(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_base/$id');
        final data = unwrapGateDataMap(res.data) ?? {};
        return VehicleSummary.fromJson(data);
      });

  Future<GateEligibility> getEligibility(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_base/$id/gate-eligibility');
        final data = unwrapGateDataMap(res.data) ?? {};
        return GateEligibility.fromJson(data);
      });

  /// Gate-out. Do NOT include approvedByUserId or occurredAt in the body.
  Future<GateOutResult> gateOut(
    String id, {
    required double meterReading,
    String? driverId,
    String? checkpoint,
    String? gatePassNo,
    String? notes,
    bool? allowOverride,
    String? overrideReason,
    required String idempotencyKey,
  }) =>
      _guarded(() async {
        final body = <String, dynamic>{
          'meterReading': meterReading,
          if (driverId != null && driverId.trim().isNotEmpty)
            'driverId': driverId.trim(),
          if (checkpoint != null && checkpoint.trim().isNotEmpty)
            'checkpoint': checkpoint.trim(),
          if (gatePassNo != null && gatePassNo.trim().isNotEmpty)
            'gatePassNo': gatePassNo.trim(),
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          if (allowOverride == true) 'allowOverride': true,
          if (allowOverride == true &&
              overrideReason != null &&
              overrideReason.trim().isNotEmpty)
            'overrideReason': overrideReason.trim(),
        };
        // Hard guard: never trust / send client approver identity.
        body.remove('approvedByUserId');
        body.remove('occurredAt');

        final res = await _dio.post<dynamic>(
          '$_base/$id/gate-out',
          data: body,
          options: Options(
            headers: {'Idempotency-Key': idempotencyKey},
          ),
        );
        final data = unwrapGateDataMap(res.data) ?? {};
        return GateOutResult.fromJson(data);
      });

  Future<GateInResult> gateIn(
    String id, {
    required double meterReading,
    String? checkpoint,
    String? notes,
    required String idempotencyKey,
  }) =>
      _guarded(() async {
        final body = <String, dynamic>{
          'meterReading': meterReading,
          if (checkpoint != null && checkpoint.trim().isNotEmpty)
            'checkpoint': checkpoint.trim(),
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        };
        body.remove('approvedByUserId');
        body.remove('occurredAt');

        final res = await _dio.post<dynamic>(
          '$_base/$id/gate-in',
          data: body,
          options: Options(
            headers: {'Idempotency-Key': idempotencyKey},
          ),
        );
        final data = unwrapGateDataMap(res.data) ?? {};
        return GateInResult.fromJson(data);
      });

  Future<List<GateMovement>> listMovements(String id, {int limit = 50}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '$_base/$id/gate-movements',
          queryParameters: {'limit': limit},
        );
        final data = unwrapGateData(res.data);
        return extractMovementList(data).map(GateMovement.fromJson).toList();
      });
}

final gateApiClientProvider = Provider<GateApiClient>((ref) {
  return GateApiClient(ref.watch(dioProvider));
});
