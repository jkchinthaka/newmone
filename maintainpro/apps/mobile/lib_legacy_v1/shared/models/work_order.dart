class WorkOrder {
  WorkOrder({
    required this.id,
    required this.code,
    required this.title,
    required this.priority,
    required this.status,
  });

  final String id;
  final String code;
  final String title;
  final String priority;
  final String status;
}
