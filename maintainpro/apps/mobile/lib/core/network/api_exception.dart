import 'package:dio/dio.dart';

/// Typed API failures mapped from HTTP / transport errors.
sealed class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.code, this.details});

  final String message;
  final int? statusCode;
  final String? code;
  final Object? details;

  @override
  String toString() => 'ApiException($statusCode): $message';

  factory ApiException.fromDio(DioException error) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    String message = error.message ?? 'Request failed';
    String? code;
    if (data is Map) {
      final map = Map<String, dynamic>.from(data);
      message = (map['message'] ?? map['error'] ?? message).toString();
      code = map['code']?.toString();
      if (map['data'] is Map && (map['data'] as Map)['message'] != null) {
        message = (map['data'] as Map)['message'].toString();
      }
    }

    switch (status) {
      case 400:
        return BadRequestException(message, code: code, details: data);
      case 401:
        return UnauthorizedException(message, code: code);
      case 403:
        return ForbiddenException(message, code: code);
      case 404:
        return NotFoundException(message, code: code);
      case 409:
        return ConflictException(message, code: code, details: data);
      case 429:
        return RateLimitedException(message, code: code);
      case 500:
      case 502:
      case 503:
      case 504:
        return ServerException(message, statusCode: status, code: code);
      default:
        if (error.type == DioExceptionType.connectionTimeout ||
            error.type == DioExceptionType.receiveTimeout ||
            error.type == DioExceptionType.sendTimeout) {
          return const NetworkException('Connection timed out');
        }
        if (error.type == DioExceptionType.connectionError) {
          return const NetworkException('Unable to reach the server');
        }
        return UnknownApiException(message, statusCode: status, code: code);
    }
  }
}

final class BadRequestException extends ApiException {
  const BadRequestException(super.message, {super.code, super.details})
      : super(statusCode: 400);
}

final class UnauthorizedException extends ApiException {
  const UnauthorizedException(super.message, {super.code})
      : super(statusCode: 401);
}

final class ForbiddenException extends ApiException {
  const ForbiddenException(super.message, {super.code})
      : super(statusCode: 403);
}

final class NotFoundException extends ApiException {
  const NotFoundException(super.message, {super.code})
      : super(statusCode: 404);
}

final class ConflictException extends ApiException {
  const ConflictException(super.message, {super.code, super.details})
      : super(statusCode: 409);
}

final class RateLimitedException extends ApiException {
  const RateLimitedException(super.message, {super.code})
      : super(statusCode: 429);
}

final class ServerException extends ApiException {
  const ServerException(super.message, {super.statusCode, super.code})
      : super();
}

final class NetworkException extends ApiException {
  const NetworkException(super.message) : super(statusCode: null);
}

final class UnknownApiException extends ApiException {
  const UnknownApiException(super.message, {super.statusCode, super.code})
      : super();
}
