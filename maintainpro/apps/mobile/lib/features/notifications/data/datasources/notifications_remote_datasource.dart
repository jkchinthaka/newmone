import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/app_notification.dart';

class NotificationsRemoteDataSource {
  NotificationsRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<AppNotification>> list({int page = 1, int limit = 30}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.notifications,
        queryParameters: {'page': page, 'limit': limit},
      );
      final body = res.data;
      List<dynamic> items = const [];
      if (body is Map<String, dynamic>) {
        final data = body['data'] ?? body;
        if (data is List) {
          items = data;
        } else if (data is Map<String, dynamic>) {
          final list = data['items'] ?? data['notifications'] ?? data['data'];
          if (list is List) items = list;
        }
      } else if (body is List) {
        items = body;
      }
      return items
          .whereType<Map<String, dynamic>>()
          .map(AppNotification.fromJson)
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<int> unreadCount() async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.notificationsUnreadCount);
      final body = res.data;
      if (body is Map<String, dynamic>) {
        final data = body['data'] ?? body;
        if (data is Map<String, dynamic>) {
          return (data['count'] ?? data['unread'] ?? 0) as int;
        }
        if (data is num) return data.toInt();
      }
      if (body is num) return body.toInt();
      return 0;
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.patch<dynamic>(ApiEndpoints.notificationRead(id));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.patch<dynamic>(ApiEndpoints.notificationsReadAll);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
