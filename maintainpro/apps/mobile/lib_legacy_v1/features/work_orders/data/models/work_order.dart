/// Work order model + supporting nested models. Defensive parsing so the
/// app stays resilient to backend payload variation.
class WorkOrder {
  WorkOrder({
    required this.id,
    required this.woNumber,
    required this.title,
    required this.description,
    required this.status,
    required this.priority,
    required this.type,
    required this.createdAt,
    this.assetId,
    this.assetName,
    this.vehicleId,
    this.vehiclePlate,
    this.technicianId,
    this.technicianName,
    this.createdById,
    this.createdByName,
    this.dueDate,
    this.slaDeadline,
    this.startDate,
    this.completedDate,
    this.estimatedCost,
    this.estimatedHours,
    this.actualCost,
    this.actualHours,
    this.parts = const [],
  });

  final String id;
  final String woNumber;
  final String title;
  final String description;
  final String status;
  final String priority;
  final String type;
  final DateTime createdAt;

  final String? assetId;
  final String? assetName;
  final String? vehicleId;
  final String? vehiclePlate;
  final String? technicianId;
  final String? technicianName;
  final String? createdById;
  final String? createdByName;

  final DateTime? dueDate;
  final DateTime? slaDeadline;
  final DateTime? startDate;
  final DateTime? completedDate;

  final num? estimatedCost;
  final num? estimatedHours;
  final num? actualCost;
  final num? actualHours;

  final List<WorkOrderPart> parts;

  bool get isOverdue =>
      dueDate != null &&
      DateTime.now().isAfter(dueDate!) &&
      status != 'COMPLETED' &&
      status != 'CANCELLED';

  factory WorkOrder.fromJson(Map<String, dynamic> json) {
    String? name(dynamic v) {
      if (v is Map<String, dynamic>) {
        final dn = (v['displayName'] ?? '').toString().trim();
        if (dn.isNotEmpty) return dn;
        final fn = (v['firstName'] ?? '').toString().trim();
        final ln = (v['lastName'] ?? '').toString().trim();
        final j = [fn, ln].where((e) => e.isNotEmpty).join(' ').trim();
        if (j.isNotEmpty) return j;
        final em = (v['email'] ?? '').toString().trim();
        if (em.isNotEmpty) return em;
      }
      return null;
    }

    DateTime? date(dynamic v) {
      if (v == null) return null;
      try {
        return DateTime.parse(v.toString()).toLocal();
      } catch (_) {
        return null;
      }
    }

    final asset = json['asset'];
    final vehicle = json['vehicle'];
    final tech = json['technician'];
    final creator = json['createdBy'];

    return WorkOrder(
      id: (json['id'] ?? '').toString(),
      woNumber: (json['woNumber'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      status: (json['status'] ?? 'OPEN').toString(),
      priority: (json['priority'] ?? 'MEDIUM').toString(),
      type: (json['type'] ?? 'CORRECTIVE').toString(),
      createdAt: date(json['createdAt']) ?? DateTime.now(),
      assetId:
          (json['assetId'] ?? (asset is Map ? asset['id'] : null))?.toString(),
      assetName:
          asset is Map<String, dynamic> ? asset['name']?.toString() : null,
      vehicleId: (json['vehicleId'] ?? (vehicle is Map ? vehicle['id'] : null))
          ?.toString(),
      vehiclePlate: vehicle is Map<String, dynamic>
          ? (vehicle['plateNumber'] ?? vehicle['licensePlate'])?.toString()
          : null,
      technicianId: (json['technicianId'] ?? (tech is Map ? tech['id'] : null))
          ?.toString(),
      technicianName: name(tech),
      createdById:
          (json['createdById'] ?? (creator is Map ? creator['id'] : null))
              ?.toString(),
      createdByName: name(creator),
      dueDate: date(json['dueDate']),
      slaDeadline: date(json['slaDeadline']),
      startDate: date(json['startDate']),
      completedDate: date(json['completedDate']),
      estimatedCost: _num(json['estimatedCost']),
      estimatedHours: _num(json['estimatedHours']),
      actualCost: _num(json['actualCost']),
      actualHours: _num(json['actualHours']),
      parts: (json['parts'] is List)
          ? (json['parts'] as List)
              .whereType<Map<String, dynamic>>()
              .map(WorkOrderPart.fromJson)
              .toList()
          : const [],
    );
  }
}

num? _num(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  return num.tryParse(v.toString());
}

class WorkOrderPart {
  WorkOrderPart({
    required this.id,
    required this.partId,
    required this.quantity,
    required this.unitCost,
    this.partName,
    this.sku,
  });

  final String id;
  final String partId;
  final num quantity;
  final num unitCost;
  final String? partName;
  final String? sku;

  num get total => quantity * unitCost;

  factory WorkOrderPart.fromJson(Map<String, dynamic> json) {
    final part = json['part'];
    return WorkOrderPart(
      id: (json['id'] ?? '').toString(),
      partId: (json['partId'] ?? (part is Map ? part['id'] : '')).toString(),
      quantity: _num(json['quantity']) ?? 0,
      unitCost: _num(json['unitCost']) ?? 0,
      partName: part is Map<String, dynamic> ? part['name']?.toString() : null,
      sku: part is Map<String, dynamic> ? part['sku']?.toString() : null,
    );
  }
}

class WorkOrderNote {
  WorkOrderNote({
    required this.id,
    required this.note,
    required this.createdAt,
    this.authorName,
  });

  final String id;
  final String note;
  final DateTime createdAt;
  final String? authorName;

  factory WorkOrderNote.fromJson(Map<String, dynamic> json) {
    final author = json['author'] ?? json['user'];
    return WorkOrderNote(
      id: (json['id'] ?? '').toString(),
      note: (json['note'] ?? json['content'] ?? '').toString(),
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString())?.toLocal() ??
              DateTime.now(),
      authorName: author is Map<String, dynamic>
          ? (author['displayName'] ?? author['email'])?.toString()
          : null,
    );
  }
}

class WorkOrderAttachment {
  WorkOrderAttachment({
    required this.id,
    required this.url,
    required this.createdAt,
    this.fileName,
  });

  final String id;
  final String url;
  final DateTime createdAt;
  final String? fileName;

  factory WorkOrderAttachment.fromJson(Map<String, dynamic> json) {
    return WorkOrderAttachment(
      id: (json['id'] ?? '').toString(),
      url: (json['url'] ?? json['attachmentUrl'] ?? '').toString(),
      fileName: json['fileName']?.toString(),
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString())?.toLocal() ??
              DateTime.now(),
    );
  }
}

class WorkOrderListFilters {
  const WorkOrderListFilters({
    this.status,
    this.priority,
    this.type,
    this.assignedToMe = false,
    this.search,
  });

  final String? status;
  final String? priority;
  final String? type;
  final bool assignedToMe;
  final String? search;

  bool get isEmpty =>
      status == null &&
      priority == null &&
      type == null &&
      !assignedToMe &&
      (search == null || search!.isEmpty);

  WorkOrderListFilters copyWith({
    Object? status = _sentinel,
    Object? priority = _sentinel,
    Object? type = _sentinel,
    bool? assignedToMe,
    Object? search = _sentinel,
  }) {
    return WorkOrderListFilters(
      status: identical(status, _sentinel) ? this.status : status as String?,
      priority:
          identical(priority, _sentinel) ? this.priority : priority as String?,
      type: identical(type, _sentinel) ? this.type : type as String?,
      assignedToMe: assignedToMe ?? this.assignedToMe,
      search: identical(search, _sentinel) ? this.search : search as String?,
    );
  }
}

const _sentinel = Object();
