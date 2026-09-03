/// Asset domain model — mirrors backend `Asset` Prisma entity (string enums).
class Asset {
  Asset({
    required this.id,
    required this.assetTag,
    required this.name,
    required this.category,
    required this.condition,
    required this.status,
    required this.createdAt,
    this.description,
    this.location,
    this.manufacturer,
    this.model,
    this.serialNumber,
    this.supplier,
    this.department,
    this.ownerName,
    this.purchaseDate,
    this.purchasePrice,
    this.currentValue,
    this.meterReading,
    this.lastServiceDate,
    this.nextServiceDate,
    this.warrantyExpiry,
    this.qrCodeUrl,
    this.openWorkOrderCount = 0,
    this.workOrderCount = 0,
    this.maintenanceLogCount = 0,
    this.documentCount = 0,
    this.isArchived = false,
  });

  final String id;
  final String assetTag;
  final String name;
  final String category;
  final String condition;
  final String status;
  final DateTime createdAt;

  final String? description;
  final String? location;
  final String? manufacturer;
  final String? model;
  final String? serialNumber;
  final String? supplier;
  final String? department;
  final String? ownerName;
  final DateTime? purchaseDate;
  final num? purchasePrice;
  final num? currentValue;
  final num? meterReading;
  final DateTime? lastServiceDate;
  final DateTime? nextServiceDate;
  final DateTime? warrantyExpiry;
  final String? qrCodeUrl;

  final int openWorkOrderCount;
  final int workOrderCount;
  final int maintenanceLogCount;
  final int documentCount;
  final bool isArchived;

  bool get hasOpenWorkOrders => openWorkOrderCount > 0;

  bool get isServiceDue {
    final due = nextServiceDate;
    if (due == null) return false;
    return due.isBefore(DateTime.now().add(const Duration(days: 7)));
  }

  bool get isWarrantyExpiring {
    final w = warrantyExpiry;
    if (w == null) return false;
    final now = DateTime.now();
    return w.isAfter(now) && w.isBefore(now.add(const Duration(days: 30)));
  }

  factory Asset.fromJson(Map<String, dynamic> json) {
    DateTime? d(dynamic v) {
      if (v == null) return null;
      if (v is DateTime) return v;
      return DateTime.tryParse(v.toString());
    }

    num? n(dynamic v) {
      if (v == null) return null;
      if (v is num) return v;
      return num.tryParse(v.toString());
    }

    int i(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    return Asset(
      id: json['id'] as String,
      assetTag: (json['assetTag'] ?? '') as String,
      name: (json['name'] ?? '') as String,
      category: (json['category'] ?? 'EQUIPMENT') as String,
      condition: (json['condition'] ?? 'GOOD') as String,
      status: (json['status'] ?? 'OPERATIONAL') as String,
      createdAt: d(json['createdAt']) ?? DateTime.now(),
      description: json['description'] as String?,
      location: json['location'] as String?,
      manufacturer: json['manufacturer'] as String?,
      model: json['model'] as String?,
      serialNumber: json['serialNumber'] as String?,
      supplier: json['supplier'] as String?,
      department: json['department'] as String?,
      ownerName: json['ownerName'] as String?,
      purchaseDate: d(json['purchaseDate']),
      purchasePrice: n(json['purchasePrice']),
      currentValue: n(json['currentValue']),
      meterReading: n(json['meterReading']),
      lastServiceDate: d(json['lastServiceDate']),
      nextServiceDate: d(json['nextServiceDate']),
      warrantyExpiry: d(json['warrantyExpiry']),
      qrCodeUrl: json['qrCodeUrl'] as String?,
      openWorkOrderCount: i(json['openWorkOrderCount']),
      workOrderCount: i(json['workOrderCount']),
      maintenanceLogCount: i(json['maintenanceLogCount']),
      documentCount: i(json['documentCount']),
      isArchived: json['isArchived'] == true || json['archivedAt'] != null,
    );
  }
}

/// Result of QR validation. Backend returns
/// `{exists, assetId, assetTag, name}` from /assets/validate-tag.
class AssetTagLookup {
  const AssetTagLookup({
    required this.exists,
    this.assetId,
    this.assetTag,
    this.name,
  });

  final bool exists;
  final String? assetId;
  final String? assetTag;
  final String? name;

  factory AssetTagLookup.fromJson(Map<String, dynamic> json) {
    return AssetTagLookup(
      exists: json['exists'] == true,
      assetId: json['assetId'] as String?,
      assetTag: json['assetTag'] as String?,
      name: json['name'] as String?,
    );
  }
}

const _sentinel = Object();

class AssetListFilters {
  const AssetListFilters({
    this.status,
    this.category,
    this.condition,
    this.location,
    this.search,
    this.includeArchived = false,
  });

  final String? status;
  final String? category;
  final String? condition;
  final String? location;
  final String? search;
  final bool includeArchived;

  bool get isEmpty =>
      status == null &&
      category == null &&
      condition == null &&
      location == null &&
      (search == null || search!.isEmpty) &&
      !includeArchived;

  AssetListFilters copyWith({
    Object? status = _sentinel,
    Object? category = _sentinel,
    Object? condition = _sentinel,
    Object? location = _sentinel,
    Object? search = _sentinel,
    bool? includeArchived,
  }) {
    return AssetListFilters(
      status: identical(status, _sentinel) ? this.status : status as String?,
      category:
          identical(category, _sentinel) ? this.category : category as String?,
      condition: identical(condition, _sentinel)
          ? this.condition
          : condition as String?,
      location:
          identical(location, _sentinel) ? this.location : location as String?,
      search: identical(search, _sentinel) ? this.search : search as String?,
      includeArchived: includeArchived ?? this.includeArchived,
    );
  }
}
