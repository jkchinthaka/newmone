/// Asset / PM / job-code models — mirror Nest Prisma + list envelopes.
library;

class AssetSummary {
  const AssetSummary({
    required this.id,
    required this.assetTag,
    required this.name,
    required this.category,
    required this.status,
    required this.condition,
    this.location,
    this.department,
    this.meterReading,
    this.nextServiceDate,
    this.lastServiceDate,
    this.openWorkOrderCount = 0,
  });

  final String id;
  final String assetTag;
  final String name;
  final String category;
  final String status;
  final String condition;
  final String? location;
  final String? department;
  final num? meterReading;
  final DateTime? nextServiceDate;
  final DateTime? lastServiceDate;
  final int openWorkOrderCount;

  bool get isServiceOverdue {
    final due = nextServiceDate;
    if (due == null) return false;
    return due.isBefore(DateTime.now());
  }

  bool get isServiceDueSoon {
    final due = nextServiceDate;
    if (due == null) return false;
    final now = DateTime.now();
    return !due.isBefore(now) &&
        due.isBefore(now.add(const Duration(days: 7)));
  }

  factory AssetSummary.fromJson(Map<String, dynamic> json) {
    return AssetSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      assetTag: (json['assetTag'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      category: (json['category'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      condition: (json['condition'] ?? '').toString(),
      location: json['location']?.toString(),
      department: json['department']?.toString(),
      meterReading: json['meterReading'] is num
          ? json['meterReading'] as num
          : num.tryParse('${json['meterReading'] ?? ''}'),
      nextServiceDate: _parseDate(json['nextServiceDate']),
      lastServiceDate: _parseDate(json['lastServiceDate']),
      openWorkOrderCount: _asInt(
        json['openWorkOrderCount'] ?? json['_count']?['workOrders'],
      ),
    );
  }
}

class AssetDetail extends AssetSummary {
  const AssetDetail({
    required super.id,
    required super.assetTag,
    required super.name,
    required super.category,
    required super.status,
    required super.condition,
    super.location,
    super.department,
    super.meterReading,
    super.nextServiceDate,
    super.lastServiceDate,
    super.openWorkOrderCount,
    this.description,
    this.manufacturer,
    this.model,
    this.serialNumber,
    this.ownerName,
    this.criticality,
    this.workOrderCount = 0,
    this.maintenanceLogCount = 0,
    this.qrCodeUrl,
    this.updatedAt,
  });

  final String? description;
  final String? manufacturer;
  final String? model;
  final String? serialNumber;
  final String? ownerName;
  final String? criticality;
  final int workOrderCount;
  final int maintenanceLogCount;
  final String? qrCodeUrl;
  final DateTime? updatedAt;

  factory AssetDetail.fromJson(Map<String, dynamic> json) {
    final base = AssetSummary.fromJson(json);
    final count = json['_count'];
    return AssetDetail(
      id: base.id,
      assetTag: base.assetTag,
      name: base.name,
      category: base.category,
      status: base.status,
      condition: base.condition,
      location: base.location,
      department: base.department,
      meterReading: base.meterReading,
      nextServiceDate: base.nextServiceDate,
      lastServiceDate: base.lastServiceDate,
      openWorkOrderCount: base.openWorkOrderCount,
      description: json['description']?.toString(),
      manufacturer: json['manufacturer']?.toString(),
      model: json['model']?.toString(),
      serialNumber: json['serialNumber']?.toString(),
      ownerName: json['ownerName']?.toString(),
      criticality: json['criticality']?.toString(),
      workOrderCount: _asInt(
        json['workOrderCount'] ??
            (count is Map ? count['workOrders'] : null),
      ),
      maintenanceLogCount: _asInt(
        json['maintenanceLogCount'] ??
            (count is Map ? count['maintenanceLogs'] : null),
      ),
      qrCodeUrl: json['qrCodeUrl']?.toString(),
      updatedAt: _parseDate(json['updatedAt']),
    );
  }
}

class AssetListPage {
  const AssetListPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<AssetSummary> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasNextPage => page < totalPages;

  factory AssetListPage.fromEnvelope(dynamic body) {
    final map = body is Map ? Map<String, dynamic>.from(body) : <String, dynamic>{};
    final data = map['data'];
    final meta = map['meta'];
    final items = <AssetSummary>[];
    if (data is List) {
      for (final row in data) {
        if (row is Map) {
          items.add(AssetSummary.fromJson(Map<String, dynamic>.from(row)));
        }
      }
    }
    final metaMap =
        meta is Map ? Map<String, dynamic>.from(meta) : <String, dynamic>{};
    return AssetListPage(
      items: items,
      page: _asInt(metaMap['page'], fallback: 1),
      limit: _asInt(metaMap['limit'], fallback: 20),
      total: _asInt(metaMap['total']),
      totalPages: _asInt(metaMap['totalPages'], fallback: 1),
    );
  }
}

class MaintenanceScheduleSummary {
  const MaintenanceScheduleSummary({
    required this.id,
    required this.type,
    required this.isActive,
    this.title,
    this.frequency,
    this.assetId,
    this.vehicleId,
    this.assetTag,
    this.assetName,
    this.nextDueDate,
    this.intervalDays,
  });

  final String id;
  final String type;
  final bool isActive;
  final String? title;
  final String? frequency;
  final String? assetId;
  final String? vehicleId;
  final String? assetTag;
  final String? assetName;
  final DateTime? nextDueDate;
  final int? intervalDays;

  bool get isOverdue {
    final due = nextDueDate;
    if (due == null) return false;
    return due.isBefore(DateTime.now());
  }

  bool get isUpcoming {
    final due = nextDueDate;
    if (due == null) return false;
    final now = DateTime.now();
    return !due.isBefore(now) &&
        due.isBefore(now.add(const Duration(days: 30)));
  }

  factory MaintenanceScheduleSummary.fromJson(Map<String, dynamic> json) {
    final asset = json['asset'];
    final assetMap =
        asset is Map ? Map<String, dynamic>.from(asset) : <String, dynamic>{};
    return MaintenanceScheduleSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      isActive: json['isActive'] != false,
      title: (json['title'] ?? json['name'] ?? json['description'])?.toString(),
      frequency: json['frequency']?.toString(),
      assetId: (json['assetId'] ?? assetMap['id'])?.toString(),
      vehicleId: json['vehicleId']?.toString(),
      assetTag: assetMap['assetTag']?.toString(),
      assetName: assetMap['name']?.toString(),
      nextDueDate: _parseDate(
        json['nextDueDate'] ?? json['nextServiceDate'] ?? json['dueDate'],
      ),
      intervalDays: json['intervalDays'] is int
          ? json['intervalDays'] as int
          : int.tryParse('${json['intervalDays'] ?? ''}'),
    );
  }
}

class JobCodeSummary {
  const JobCodeSummary({
    required this.id,
    required this.code,
    required this.name,
    this.category,
    this.parentId,
    this.estimatedHours,
    this.isActive = true,
  });

  final String id;
  final String code;
  final String name;
  final String? category;
  final String? parentId;
  final num? estimatedHours;
  final bool isActive;

  factory JobCodeSummary.fromJson(Map<String, dynamic> json) {
    return JobCodeSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      category: json['category']?.toString(),
      parentId: json['parentId']?.toString(),
      estimatedHours: json['estimatedHours'] is num
          ? json['estimatedHours'] as num
          : num.tryParse('${json['estimatedHours'] ?? ''}'),
      isActive: json['isActive'] != false,
    );
  }
}

class AssetTagLookup {
  const AssetTagLookup({
    required this.exists,
    this.assetId,
  });

  final bool exists;
  final String? assetId;

  factory AssetTagLookup.fromJson(Map<String, dynamic> json) {
    return AssetTagLookup(
      exists: json['exists'] == true || json['available'] == false,
      assetId: (json['assetId'] ?? json['id'])?.toString(),
    );
  }
}

DateTime? _parseDate(dynamic v) {
  if (v == null) return null;
  if (v is DateTime) return v;
  return DateTime.tryParse(v.toString());
}

int _asInt(dynamic v, {int fallback = 0}) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v?.toString() ?? '') ?? fallback;
}
