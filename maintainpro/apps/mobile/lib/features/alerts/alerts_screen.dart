import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/i18n/app_strings.dart';
import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import '../shell/adaptive_shell.dart';
import '../notifications/data/notifications_api_client.dart';
import '../notifications/data/notifications_models.dart';
import '../notifications/notification_deep_link.dart';
import '../notifications/push_notifications_service.dart';

class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});

  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> {
  static const _pageSize = 20;

  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String _filter = 'ALL';
  final List<NotificationItem> _items = [];
  int _page = 1;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  Future<void> _load({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
        _items.clear();
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final result = await ref.read(notificationsApiClientProvider).listNotifications(
            status: _filter,
            page: _page,
            pageSize: _pageSize,
          );
      if (!mounted) return;
      setState(() {
        if (reset) {
          _items
            ..clear()
            ..addAll(result.items);
        } else {
          _items.addAll(result.items);
        }
        _total = result.total;
        _loading = false;
        _loadingMore = false;
      });
      if (_filter == 'ALL' || _filter == 'UNREAD') {
        unawaited(_refreshUnreadBadge());
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Future<void> _refreshUnreadBadge() async {
    try {
      final count =
          await ref.read(notificationsApiClientProvider).unreadCount();
      ref.read(unreadNotificationsCountProvider.notifier).state = count;
    } catch (_) {}
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(notificationsApiClientProvider).markAllRead();
      if (!mounted) return;
      await _load(reset: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _openNotification(NotificationItem item) async {
    if (!item.isRead) {
      try {
        await ref.read(notificationsApiClientProvider).markRead(item.id);
      } catch (_) {
        // Continue navigation even if mark-read fails.
      }
    }

    final route = resolveNotificationDeepLink(
      deepLink: item.deepLink,
      referenceType: item.referenceType,
      referenceId: item.referenceId,
    );

    if (!mounted) return;

    setState(() {
      final idx = _items.indexWhere((n) => n.id == item.id);
      if (idx >= 0) {
        _items[idx] = NotificationItem(
          id: item.id,
          title: item.title,
          message: item.message,
          type: item.type,
          priority: item.priority,
          isRead: true,
          readAt: DateTime.now(),
          dueAt: item.dueAt,
          createdAt: item.createdAt,
          module: item.module,
          deepLink: item.deepLink,
          referenceId: item.referenceId,
          referenceType: item.referenceType,
          overdue: item.overdue,
          preview: item.preview,
        );
      }
    });
    unawaited(_refreshUnreadBadge());

    if (route != null) {
      context.push(route);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _items.length >= _total) return;
    _page += 1;
    await _load(reset: false);
  }

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat.MMMd().add_jm();

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.navAlerts),
        actions: [
          if (_items.any((n) => !n.isRead))
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
          ...shellActions(context),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              MpSpacing.screenPadding,
              MpSpacing.sm,
              MpSpacing.screenPadding,
              0,
            ),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'ALL', label: Text('All')),
                ButtonSegment(value: 'UNREAD', label: Text('Unread')),
                ButtonSegment(value: 'READ', label: Text('Read')),
              ],
              selected: {_filter},
              onSelectionChanged: (next) {
                setState(() => _filter = next.first);
                _load(reset: true);
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading alerts…')
                : _error != null
                    ? MpErrorState(
                        title: 'Could not load alerts',
                        message: _error,
                        onRetry: () => _load(reset: true),
                      )
                    : _items.isEmpty
                        ? const MpEmptyState(
                            title: AppStrings.emptyAlerts,
                            message:
                                'In-app notifications from MaintainPro will appear here.',
                            icon: Icons.notifications_none,
                          )
                        : RefreshIndicator(
                            onRefresh: () => _load(reset: true),
                            child: ListView.separated(
                              padding: const EdgeInsets.all(
                                MpSpacing.screenPadding,
                              ),
                              itemCount:
                                  _items.length + (_items.length < _total ? 1 : 0),
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: MpSpacing.sm),
                              itemBuilder: (context, index) {
                                if (index >= _items.length) {
                                  if (!_loadingMore) {
                                    WidgetsBinding.instance
                                        .addPostFrameCallback((_) {
                                      _loadMore();
                                    });
                                  }
                                  return const Padding(
                                    padding: EdgeInsets.all(MpSpacing.md),
                                    child: Center(
                                      child: CircularProgressIndicator(),
                                    ),
                                  );
                                }

                                final item = _items[index];
                                return MpCard(
                                  onTap: () => _openNotification(item),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Icon(
                                        item.isRead
                                            ? Icons.notifications_none
                                            : Icons.notifications_active,
                                        color: item.isRead
                                            ? Theme.of(context)
                                                .colorScheme
                                                .outline
                                            : Theme.of(context)
                                                .colorScheme
                                                .primary,
                                      ),
                                      const SizedBox(width: MpSpacing.md),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              item.title,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .titleSmall
                                                  ?.copyWith(
                                                    fontWeight: item.isRead
                                                        ? FontWeight.normal
                                                        : FontWeight.w600,
                                                  ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              item.preview ?? item.message,
                                              maxLines: 3,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              dateFmt.format(item.createdAt),
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .bodySmall,
                                            ),
                                            if (item.overdue)
                                              const Padding(
                                                padding: EdgeInsets.only(
                                                  top: 4,
                                                ),
                                                child: MpStatusChip(
                                                  label: 'Overdue',
                                                  tone: MpStatusTone.warning,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
