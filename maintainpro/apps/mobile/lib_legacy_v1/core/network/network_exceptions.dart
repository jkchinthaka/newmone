import 'package:dio/dio.dart';

/// Translates Dio errors into user-friendly messages.
sealed class NetworkException implements Exception {
  const NetworkException(this.message, {this.statusCode, this.cause});

  final String message;
  final int? statusCode;
  final Object? cause;

  @override
  String toString() => message;

  factory NetworkException.fromDio(DioException error) {
    final response = error.response;
    if (response != null) {
      final code = response.statusCode ?? 0;
      final body = response.data;
      String? backendMessage;
      if (body is Map<String, dynamic>) {
        final raw = body['message'] ?? body['error'] ?? body['detail'];
        if (raw is String) backendMessage = raw;
        if (raw is List && raw.isNotEmpty) backendMessage = raw.join(', ');
      }

      if (code == 400) {
        return BadRequestException(backendMessage ?? 'The request was invalid.',
            statusCode: code, cause: error);
      }
      if (code == 401) {
        return UnauthorizedException(
            backendMessage ?? 'Your session has expired. Please log in again.',
            statusCode: code,
            cause: error);
      }
      if (code == 403) {
        return ForbiddenException(
            backendMessage ?? "You don't have permission for this action.",
            statusCode: code,
            cause: error);
      }
      if (code == 404) {
        return NotFoundException(
            backendMessage ?? 'The requested resource was not found.',
            statusCode: code,
            cause: error);
      }
      if (code == 409) {
        return ConflictException(
            backendMessage ?? 'This action conflicts with existing data.',
            statusCode: code,
            cause: error);
      }
      if (code >= 500) {
        return ServerException(
            backendMessage ?? 'Server error. Please try again later.',
            statusCode: code,
            cause: error);
      }
      return ApiException(backendMessage ?? 'Request failed.',
          statusCode: code, cause: error);
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const TimeoutException(
            'The connection timed out. Check your internet and try again.');
      case DioExceptionType.connectionError:
        return const NoConnectionException(
            'No internet connection. Showing cached data when available.');
      case DioExceptionType.cancel:
        return const CancelledException('Request was cancelled.');
      default:
        return NetworkException._unknown(
            error.message ?? 'Unexpected network error.',
            cause: error);
    }
  }

  factory NetworkException._unknown(String message, {Object? cause}) =>
      ApiException(message, cause: cause);
}

class ApiException extends NetworkException {
  const ApiException(super.message, {super.statusCode, super.cause});
}

class BadRequestException extends NetworkException {
  const BadRequestException(super.message, {super.statusCode, super.cause});
}

class UnauthorizedException extends NetworkException {
  const UnauthorizedException(super.message, {super.statusCode, super.cause});
}

class ForbiddenException extends NetworkException {
  const ForbiddenException(super.message, {super.statusCode, super.cause});
}

class NotFoundException extends NetworkException {
  const NotFoundException(super.message, {super.statusCode, super.cause});
}

class ConflictException extends NetworkException {
  const ConflictException(super.message, {super.statusCode, super.cause});
}

class ServerException extends NetworkException {
  const ServerException(super.message, {super.statusCode, super.cause});
}

class TimeoutException extends NetworkException {
  const TimeoutException(super.message) : super(statusCode: 408);
}

class NoConnectionException extends NetworkException {
  const NoConnectionException(super.message);
}

class CancelledException extends NetworkException {
  const CancelledException(super.message);
}
