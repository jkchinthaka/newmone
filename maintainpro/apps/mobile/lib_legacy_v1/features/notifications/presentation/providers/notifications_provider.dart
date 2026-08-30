import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/notifications_remote_datasource.dart';
import '../../data/models/app_notification.dart';

final notificationsRemoteProvider =
    Provider<NotificationsRemoteDataSource>((ref) {
  return NotificationsRemoteDataSource(ref.watch(dioProvider));
});

class NotificationsState {
  const NotificationsState({
    this.items = const [],
    this.loading = false,
    this.error,
    this.unreadCount = 0,
  });

  final List<AppNotification> items;
  final bool loading;
  final String? error;
  final int unreadCount;

  NotificationsState copyWith({
    List<AppNotification>? items,
    bool? loading,
    String? error,
    int? unreadCount,
    bool clearError = false,
  }) {
    return NotificationsState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
      unreadCount: unreadCount ?? this.unreadCount,
    );
  }
}

final notificationsProvider =
    NotifierProvider<NotificationsNotifier, NotificationsState>(
  NotificationsNotifier.new,
);

class NotificationsNotifier extends Notifier<NotificationsState> {
  late final NotificationsRemoteDataSource _remote;

  @override
  NotificationsState build() {
    _remote = ref.read(notificationsRemoteProvider);
    return const NotificationsState();
  }

  Future<void> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final items = await _remote.list();
      final unread = items.where((n) => !n.isRead).length;
      state = state.copyWith(items: items, loading: false, unreadCount: unread);
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  Future<void> refreshUnreadCount() async {
    try {
      final count = await _remote.unreadCount();
      state = state.copyWith(unreadCount: count);
    } catch (_) {
      // ignore
    }
  }

  Future<void> markRead(String id) async {
    final updated = state.items
        .map((n) => n.id == id ? n.copyWith(isRead: true) : n)
        .toList();
    final unread = updated.where((n) => !n.isRead).length;
    state = state.copyWith(items: updated, unreadCount: unread);
    try {
      await _remote.markRead(id);
    } catch (_) {/* ignore - optimistic */}
  }

  Future<void> markAllRead() async {
    final updated = state.items.map((n) => n.copyWith(isRead: true)).toList();
    state = state.copyWith(items: updated, unreadCount: 0);
    try {
      await _remote.markAllRead();
    } catch (_) {}
  }

  void prepend(AppNotification n) {
    state = state.copyWith(
      items: [n, ...state.items],
      unreadCount: state.unreadCount + (n.isRead ? 0 : 1),
    );
  }
}
