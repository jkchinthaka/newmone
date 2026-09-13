import '../../core/network/api_exception.dart';

/// Maps Nest `/mobile/fg/session/bootstrap` failures to safe, user-facing text.
/// Never includes URLs, tokens, stack traces, or internal hostnames.
String fgBootstrapUserMessage(Object error) {
  if (error is ApiException) {
    return _fromApiException(error);
  }
  return 'FG Digital Recording could not start. Try again.';
}

String _fromApiException(ApiException e) {
  final code = e.code?.toUpperCase();
  final message = e.message.trim();
  final lower = message.toLowerCase();

  if (e is NotFoundException ||
      code == 'NOT_FOUND' ||
      (e.statusCode == 404 && lower.contains('mobile/fg'))) {
    return 'FG mobile gateway is not available on this server. '
        'Ask your administrator to deploy the latest MaintainPro API with mobile FG support.';
  }

  if (e is ForbiddenException ||
      code == 'FORBIDDEN' ||
      lower.contains('missing required permission') ||
      lower.contains('fg.access')) {
    return 'You do not have permission to use FG Digital Recording. '
        'Your account needs fg.access (or admin).';
  }

  if (e is UnauthorizedException ||
      code == 'UNAUTHENTICATED' ||
      code == 'AUTHENTICATION_REQUIRED') {
    return 'Your session expired. Sign in again, then reopen FG Digital Recording.';
  }

  if (e is NetworkException ||
      lower.contains('timed out') ||
      lower.contains('unable to reach')) {
    return 'Unable to reach the server. Check your connection and try again.';
  }

  if (e.statusCode == 503 ||
      code == 'UPSTREAM_UNAVAILABLE' ||
      lower.contains('fg mobile broker is not configured') ||
      lower.contains('fg sso is not configured') ||
      lower.contains('fg session redis')) {
    return 'FG Digital Recording is not configured on this server. '
        'Contact your administrator.';
  }

  if (e is ServerException ||
      e.statusCode == 502 ||
      e.statusCode == 504 ||
      lower.contains('fg upstream') ||
      lower.contains('unexpected error occurred')) {
    return 'FG Digital Recording service is temporarily unavailable. Try again shortly.';
  }

  if (message.isNotEmpty &&
      !lower.contains('exception(') &&
      message.length <= 200) {
    return message;
  }

  return 'FG Digital Recording could not start. Try again.';
}
