class AppNotification {
  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.isRead,
    required this.createdAt,
    this.entityType,
    this.entityId,
    this.priority,
  });

  final String id;
  final String title;
  final String body;
  final String type;
  final bool isRead;
  final DateTime createdAt;
  final String? entityType;
  final String? entityId;
  final String? priority;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      body: (json['message'] ?? json['body'] ?? '').toString(),
      type: (json['type'] ?? 'INFO').toString(),
      isRead: json['isRead'] == true || json['read'] == true,
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString())?.toLocal() ??
              DateTime.now(),
      entityType: json['entityType']?.toString(),
      entityId: json['entityId']?.toString(),
      priority: json['priority']?.toString(),
    );
  }

  AppNotification copyWith({bool? isRead}) => AppNotification(
        id: id,
        title: title,
        body: body,
        type: type,
        isRead: isRead ?? this.isRead,
        createdAt: createdAt,
        entityType: entityType,
        entityId: entityId,
        priority: priority,
      );
}
