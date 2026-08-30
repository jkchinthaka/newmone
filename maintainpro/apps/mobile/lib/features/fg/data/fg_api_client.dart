import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/dio_client.dart';
import 'fg_models.dart';

/// Nest BFF client for `/mobile/fg/*`.
///
/// Uses MaintainPro Bearer only (via [dioProvider]). Never stores or reads
/// `fg_sessionid` / CSRF cookies — those stay on the Nest broker.
///
/// Submit / review / QA decisions accept an [idempotencyKey]; the Nest BFF
/// forwards it to Django for server-side idempotency. Pair with client-side
/// [InFlightGuard] to prevent double taps.
class FgApiClient {
  FgApiClient(this._dio);

  final Dio _dio;

  static const _base = '/mobile/fg';

  bool _bootstrapped = false;

  bool get isBootstrapped => _bootstrapped;

  void resetBootstrap() => _bootstrapped = false;

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  /// Bootstrap FG broker session, then run [action].
  /// On 401 after a prior bootstrap, clears flag and retries once.
  Future<T> withBootstrap<T>(Future<T> Function() action) async {
    await ensureBootstrapped();
    try {
      return await action();
    } on UnauthorizedException {
      _bootstrapped = false;
      await ensureBootstrapped();
      return action();
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        _bootstrapped = false;
        await ensureBootstrapped();
        try {
          return await action();
        } on DioException catch (e2) {
          throwApiException(e2);
        }
      }
      throwApiException(e);
    }
  }

  Future<FgSessionStatus> ensureBootstrapped({bool force = false}) async {
    if (_bootstrapped && !force) {
      return const FgSessionStatus(authenticated: true);
    }
    final status = await bootstrap();
    _bootstrapped = status.authenticated;
    return status;
  }

  Future<FgSessionStatus> bootstrap() => _guarded(() async {
        final res = await _dio.post<dynamic>('$_base/session/bootstrap');
        final data = unwrapFgDataMap(res.data) ?? {};
        final status = FgSessionStatus.fromJson(data);
        _bootstrapped = status.authenticated;
        return status;
      });

  Future<FgSessionStatus> getSession() => withBootstrap(() async {
        final res = await _dio.get<dynamic>('$_base/session');
        final data = unwrapFgDataMap(res.data) ?? {};
        return FgSessionStatus.fromJson(data);
      });

  Future<void> deleteSession() => _guarded(() async {
        await _dio.delete<dynamic>('$_base/session');
        _bootstrapped = false;
      });

  Future<List<VehicleResult>> searchCl30Vehicles(String q) =>
      withBootstrap(() async {
        final res = await _dio.get<dynamic>(
          '$_base/cl30/vehicles',
          queryParameters: {if (q.isNotEmpty) 'q': q},
        );
        final data = unwrapFgData(res.data);
        return extractResultsList(data).map(VehicleResult.fromJson).toList();
      });

  /// Opens a CL30 record. [occurrenceToken] is required by the Nest BFF.
  Future<FgOpenRecordResult> openCl30Record({
    required String occurrenceToken,
    String? date,
  }) async {
    if (!isValidCl30OccurrenceToken(occurrenceToken)) {
      throw const BadRequestException(
        'occurrenceToken must match [A-Za-z0-9._-]{8,80}',
      );
    }
    return withBootstrap(() async {
      final res = await _dio.post<dynamic>(
        '$_base/cl30/records/open',
        data: {
          'occurrenceToken': occurrenceToken,
          if (date != null && date.isNotEmpty) 'date': date,
        },
      );
      final data = unwrapFgDataMap(res.data) ?? {};
      return FgOpenRecordResult.fromJson(data);
    });
  }

  Future<FgRecordDetail> getCl30Record(String recordId) =>
      withBootstrap(() async {
        final res = await _dio.get<dynamic>('$_base/cl30/records/$recordId');
        final data = unwrapFgDataMap(res.data) ?? {};
        return FgRecordDetail.fromJson(data);
      });

  Future<FgSaveResult> saveCl30Record({
    required String recordId,
    required Map<String, dynamic> fields,
    required int expectedDraftVersion,
  }) =>
      withBootstrap(() async {
        final res = await _dio.post<dynamic>(
          '$_base/cl30/records/$recordId/save',
          data: {
            'fields': fields,
            'expectedDraftVersion': expectedDraftVersion,
          },
        );
        final data = unwrapFgDataMap(res.data) ?? {};
        return FgSaveResult.fromJson(data);
      });

  /// Online submit. Pass a stable [idempotencyKey] (UUID) for server idempotency.
  Future<Map<String, dynamic>> submitCl30Record({
    required String recordId,
    String? idempotencyKey,
  }) =>
      withBootstrap(() async {
        final res = await _dio.post<dynamic>(
          '$_base/cl30/records/$recordId/submit',
          data: {
            if (idempotencyKey != null && idempotencyKey.isNotEmpty)
              'idempotencyKey': idempotencyKey,
          },
        );
        return unwrapFgDataMap(res.data) ?? {};
      });

  Future<List<FgRecordSummary>> history({
    String? dateFrom,
    String? dateTo,
    String? vehicle,
    String? status,
    String? page,
    String formCode = kCl30FormCode,
  }) =>
      withBootstrap(() async {
        final res = await _dio.get<dynamic>(
          '$_base/history',
          queryParameters: {
            'formCode': formCode,
            if (dateFrom != null) 'dateFrom': dateFrom,
            if (dateTo != null) 'dateTo': dateTo,
            if (vehicle != null) 'vehicle': vehicle,
            if (status != null) 'status': status,
            if (page != null) 'page': page,
          },
        );
        final data = unwrapFgData(res.data);
        return extractResultsList(data).map(FgRecordSummary.fromJson).toList();
      });

  Future<List<FgSubmission>> listReviews({String? page}) =>
      withBootstrap(() async {
        final res = await _dio.get<dynamic>(
          '$_base/reviews',
          queryParameters: {if (page != null) 'page': page},
        );
        final data = unwrapFgData(res.data);
        return extractResultsList(data).map(FgSubmission.fromJson).toList();
      });

  Future<FgReviewDetail> getReview(String submissionId) =>
      withBootstrap(() async {
        final res = await _dio.get<dynamic>('$_base/reviews/$submissionId');
        final data = unwrapFgDataMap(res.data) ?? {};
        return FgReviewDetail.fromJson(data);
      });

  /// Decision: `APPROVED` | `RETURNED_FOR_CORRECTION`.
  /// [idempotencyKey] is forwarded for server-side idempotency.
  Future<Map<String, dynamic>> reviewDecision({
    required String submissionId,
    required String decision,
    String? reviewNote,
    String? idempotencyKey,
  }) =>
      withBootstrap(() async {
        final normalized = decision.trim().toUpperCase();
        if (normalized != 'APPROVED' &&
            normalized != 'RETURNED_FOR_CORRECTION') {
          throw const BadRequestException(
            'decision must be APPROVED or RETURNED_FOR_CORRECTION',
          );
        }
        final res = await _dio.post<dynamic>(
          '$_base/reviews/$submissionId/decision',
          data: {
            'decision': normalized,
            if (reviewNote != null) 'reviewNote': reviewNote,
            if (idempotencyKey != null && idempotencyKey.isNotEmpty)
              'idempotencyKey': idempotencyKey,
          },
        );
        return unwrapFgDataMap(res.data) ?? {};
      });

  Future<List<FgSubmission>> listQa({String? page}) => withBootstrap(() async {
        final res = await _dio.get<dynamic>(
          '$_base/qa',
          queryParameters: {if (page != null) 'page': page},
        );
        final data = unwrapFgData(res.data);
        return extractResultsList(data).map(FgSubmission.fromJson).toList();
      });

  Future<FgQaDetail> getQa(String submissionId) => withBootstrap(() async {
        final res = await _dio.get<dynamic>('$_base/qa/$submissionId');
        final data = unwrapFgDataMap(res.data) ?? {};
        return FgQaDetail.fromJson(data);
      });

  /// Decision: `RELEASE` | `HOLD` | `REJECT`.
  /// Sends Nest BFF field `note` (contract alias `reviewNote` mapped here).
  Future<Map<String, dynamic>> qaDecision({
    required String submissionId,
    required String decision,
    String? reviewNote,
    String? idempotencyKey,
  }) =>
      withBootstrap(() async {
        final normalized = decision.trim().toUpperCase();
        if (normalized != 'RELEASE' &&
            normalized != 'HOLD' &&
            normalized != 'REJECT') {
          throw const BadRequestException(
            'decision must be RELEASE, HOLD, or REJECT',
          );
        }
        final res = await _dio.post<dynamic>(
          '$_base/qa/$submissionId/decision',
          data: {
            'decision': normalized,
            // Nest controller expects `note`; also send reviewNote for forward compat.
            if (reviewNote != null) ...{
              'note': reviewNote,
              'reviewNote': reviewNote,
            },
            if (idempotencyKey != null && idempotencyKey.isNotEmpty)
              'idempotencyKey': idempotencyKey,
          },
        );
        return unwrapFgDataMap(res.data) ?? {};
      });
}

final fgApiClientProvider = Provider<FgApiClient>((ref) {
  return FgApiClient(ref.watch(dioProvider));
});
