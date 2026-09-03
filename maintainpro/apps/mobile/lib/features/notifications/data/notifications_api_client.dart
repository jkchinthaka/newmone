import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'notifications_models.dart';

class NotificationsApiClient {
  NotificationsApiClient(this._dio);

  final Dio _dio;

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<NotificationsPage> listNotifications({
    String status = 'ALL',
    int page = 1,
    int pageSize = 20,
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/notifications',
          queryParameters: {
            'status': status,
            'page': page,
            'pageSize': pageSize,
          },
        );
        return _parsePage(res.data, page, pageSize);
      });

  Future<int> unreadCount() async {
    final page = await listNotifications(status: 'UNREAD', page: 1, pageSize: 1);
    return page.total;
  }

  Future<NotificationItem> markRead(String id) => _guarded(() async {
        final res = await _dio.patch<dynamic>('/notifications/$id/read');
        return NotificationItem.fromJson(_unwrapMap(res.data));
      });

  Future<int> markAllRead() => _guarded(() async {
        final res = await _dio.patch<dynamic>('/notifications/mark-all-read');
        final data = _unwrap(res.data);
    if (data is Map && data['updated'] != null) {
      return (data['updated'] as num).toInt();
    }
        return 0;
      });

  Future<void> registerPushDevice({
    required String installationId,
    required String token,
    required String platform,
    String provider = 'FCM',
    String? appVersion,
    String? locale,
    String? deviceName,
  }) =>
      _guarded(() async {
        await _dio.post<dynamic>(
          '/notifications/push/devices',
          data: {
            'installationId': installationId,
            'token': token,
            'platform': platform,
            'provider': provider,
            if (appVersion != null && appVersion.isNotEmpty)
              'appVersion': appVersion,
            if (locale != null && locale.isNotEmpty) 'locale': locale,
            if (deviceName != null && deviceName.isNotEmpty)
              'deviceName': deviceName,
          },
        );
      });

  Future<void> unregisterPushDevice(String installationId) =>
      _guarded(() async {
        await _dio.delete<dynamic>(
          '/notifications/push/devices/$installationId',
        );
      });

  NotificationsPage _parsePage(dynamic body, int page, int pageSize) {
    final envelope = body is Map ? Map<String, dynamic>.from(body) : <String, dynamic>{};
    final data = _unwrap(body);
    final meta = envelope['meta'] is Map
        ? Map<String, dynamic>.from(envelope['meta'] as Map)
        : <String, dynamic>{};

    List<dynamic> rawItems = const [];
    if (data is Map && data['items'] is List) {
      rawItems = data['items'] as List;
    } else if (data is List) {
      rawItems = data;
    }

    final items = rawItems
        .whereType<Map>()
        .map((e) => NotificationItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();

    final total = (meta['total'] as num?)?.toInt() ?? items.length;
    final limit = (meta['limit'] as num?)?.toInt() ?? pageSize;
    final currentPage = (meta['page'] as num?)?.toInt() ?? page;

    return NotificationsPage(
      items: items,
      page: currentPage,
      pageSize: limit,
      total: total,
    );
  }

  dynamic _unwrap(dynamic body) {
    if (body is Map && body.containsKey('data')) return body['data'];
    return body;
  }

  Map<String, dynamic> _unwrapMap(dynamic body) {
    final data = _unwrap(body);
    if (data is Map) return Map<String, dynamic>.from(data);
    return {};
  }
}

final notificationsApiClientProvider = Provider<NotificationsApiClient>((ref) {
  return NotificationsApiClient(ref.watch(dioProvider));
});
