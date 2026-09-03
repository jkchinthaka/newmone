import '../network/api_exception.dart';

/// Permanent outbox failure — do not retry without operator intervention.
class SyncPermanentException implements Exception {
  SyncPermanentException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Transient outbox failure — eligible for retry/backoff.
class SyncRetryableException implements Exception {
  SyncRetryableException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Classifies sync/API failures for outbox drain decisions.
class SyncFailureClassifier {
  const SyncFailureClassifier();

  /// Returns true when the failure should be marked FAILED_PERMANENT.
  bool isPermanent(Object error) {
    if (error is SyncPermanentException) return true;
    if (error is SyncRetryableException) return false;

    if (error is ForbiddenException ||
        error is NotFoundException ||
        error is BadRequestException ||
        error is ConflictException) {
      return true;
    }

    if (error is UnauthorizedException) {
      // Token refresh is handled by Dio; a remaining 401 is retryable once
      // the user re-authenticates (do not permanently drop the mutation).
      return false;
    }

    if (error is NetworkException || error is ServerException) {
      return false;
    }

    if (error is ApiException) {
      final status = error.statusCode;
      if (status == null) return false;
      if (status == 408 || status == 429) return false;
      if (status >= 400 && status < 500) return true;
      return false;
    }

    final text = error.toString().toLowerCase();
    if (text.contains('no sync handler')) return true;
    if (text.contains('unsupported work_order operation')) return true;
    return false;
  }
}
