class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.priority,
    required this.isRead,
    this.readAt,
    this.dueAt,
    required this.createdAt,
    this.module,
    this.deepLink,
    this.referenceId,
    this.referenceType,
    this.overdue = false,
    this.preview,
  });

  final String id;
  final String title;
  final String message;
  final String type;
  final String priority;
  final bool isRead;
  final DateTime? readAt;
  final DateTime? dueAt;
  final DateTime createdAt;
  final String? module;
  final String? deepLink;
  final String? referenceId;
  final String? referenceType;
  final bool overdue;
  final String? preview;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      message: (json['message'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      priority: (json['priority'] ?? 'NORMAL').toString(),
      isRead: json['isRead'] == true,
      readAt: _parseDate(json['readAt']),
      dueAt: _parseDate(json['dueAt']),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0),
      module: json['module']?.toString(),
      deepLink: json['deepLink']?.toString(),
      referenceId: json['referenceId']?.toString(),
      referenceType: json['referenceType']?.toString(),
      overdue: json['overdue'] == true,
      preview: json['preview']?.toString(),
    );
  }
}

class NotificationsPage {
  const NotificationsPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
    this.unreadCount,
  });

  final List<NotificationItem> items;
  final int page;
  final int pageSize;
  final int total;
  final int? unreadCount;

  bool get hasMore => page * pageSize < total;
}

DateTime? _parseDate(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  return DateTime.tryParse(value.toString());
}
