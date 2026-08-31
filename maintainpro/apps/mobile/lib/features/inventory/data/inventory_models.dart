/// Inventory / procurement read models — server fields are authoritative.
library;

class InventoryPartSummary {
  const InventoryPartSummary({
    required this.id,
    required this.partNumber,
    required this.name,
    required this.category,
    required this.quantityInStock,
    this.availableQuantity,
    this.reservedQuantity,
    this.minimumStock = 0,
    this.reorderPoint = 0,
    this.unitCost = 0,
    this.unit,
    this.location,
    this.supplierName,
    this.isLowStock = false,
    this.isOutOfStock = false,
  });

  final String id;
  final String partNumber;
  final String name;
  final String category;
  final num quantityInStock;
  final num? availableQuantity;
  final num? reservedQuantity;
  final num minimumStock;
  final num reorderPoint;
  final num unitCost;
  final String? unit;
  final String? location;
  final String? supplierName;
  final bool isLowStock;
  final bool isOutOfStock;

  num get displayAvailable => availableQuantity ?? quantityInStock;

  factory InventoryPartSummary.fromJson(Map<String, dynamic> json) {
    final onHand = _num(json['quantityInStock']);
    final available = json['availableQuantity'] != null
        ? _num(json['availableQuantity'])
        : onHand;
    final minimum = _num(json['minimumStock']);
    final reorder = _num(json['reorderPoint']);
    final threshold = minimum > 0 ? minimum : reorder;
    final out = onHand <= 0;
    final low = !out && threshold > 0 && onHand <= threshold;

    return InventoryPartSummary(
      id: (json['id'] ?? '').toString(),
      partNumber: (json['partNumber'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      category: (json['category'] ?? '').toString(),
      quantityInStock: onHand,
      availableQuantity: available,
      reservedQuantity: json['reservedQuantity'] != null
          ? _num(json['reservedQuantity'])
          : null,
      minimumStock: minimum,
      reorderPoint: reorder,
      unitCost: _num(json['unitCost']),
      unit: json['unit']?.toString(),
      location: json['location']?.toString(),
      supplierName: json['supplier'] is Map
          ? (json['supplier'] as Map)['name']?.toString()
          : null,
      isLowStock: low,
      isOutOfStock: out,
    );
  }
}

class StockMovementSummary {
  const StockMovementSummary({
    required this.id,
    required this.type,
    required this.quantity,
    required this.createdAt,
    this.reference,
    this.notes,
  });

  final String id;
  final String type;
  final num quantity;
  final DateTime? createdAt;
  final String? reference;
  final String? notes;

  factory StockMovementSummary.fromJson(Map<String, dynamic> json) {
    return StockMovementSummary(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      quantity: _num(json['quantity']),
      createdAt: _parseDate(json['createdAt']),
      reference: json['reference']?.toString(),
      notes: json['notes']?.toString(),
    );
  }
}

class WarehouseSummary {
  const WarehouseSummary({
    required this.id,
    required this.code,
    required this.name,
    this.isDefault = false,
  });

  final String id;
  final String code;
  final String name;
  final bool isDefault;

  factory WarehouseSummary.fromJson(Map<String, dynamic> json) {
    return WarehouseSummary(
      id: (json['id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      name: (json['name'] ?? json['code'] ?? '').toString(),
      isDefault: json['isDefault'] == true,
    );
  }
}

class SupplierSummary {
  const SupplierSummary({
    required this.id,
    required this.name,
    this.vendorCode,
    this.contactName,
    this.email,
    this.phone,
    this.blacklisted = false,
  });

  final String id;
  final String name;
  final String? vendorCode;
  final String? contactName;
  final String? email;
  final String? phone;
  final bool blacklisted;

  factory SupplierSummary.fromJson(Map<String, dynamic> json) {
    return SupplierSummary(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      vendorCode: json['vendorCode']?.toString(),
      contactName: json['contactName']?.toString(),
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      blacklisted: json['blacklisted'] == true,
    );
  }
}

class PurchaseOrderSummary {
  const PurchaseOrderSummary({
    required this.id,
    required this.poNumber,
    required this.status,
    required this.totalAmount,
    this.workflowStatus,
    this.supplierName,
    this.createdAt,
  });

  final String id;
  final String poNumber;
  final String status;
  final num totalAmount;
  final String? workflowStatus;
  final String? supplierName;
  final DateTime? createdAt;

  factory PurchaseOrderSummary.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderSummary(
      id: (json['id'] ?? '').toString(),
      poNumber: (json['poNumber'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      totalAmount: _num(json['totalAmount']),
      workflowStatus: json['workflowStatus']?.toString(),
      supplierName: json['supplier'] is Map
          ? (json['supplier'] as Map)['name']?.toString()
          : null,
      createdAt: _parseDate(json['createdAt']),
    );
  }
}

class PurchaseOrderDetail extends PurchaseOrderSummary {
  const PurchaseOrderDetail({
    required super.id,
    required super.poNumber,
    required super.status,
    required super.totalAmount,
    super.workflowStatus,
    super.supplierName,
    super.createdAt,
    this.lines = const [],
    this.approvals = const [],
    this.requiresFinanceApproval = false,
    this.notes,
  });

  final List<PurchaseOrderLineSummary> lines;
  final List<PurchaseOrderApprovalSummary> approvals;
  final bool requiresFinanceApproval;
  final String? notes;

  factory PurchaseOrderDetail.fromJson(Map<String, dynamic> json) {
    final linesRaw = json['lines'];
    final approvalsRaw = json['approvals'];
    return PurchaseOrderDetail(
      id: (json['id'] ?? '').toString(),
      poNumber: (json['poNumber'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      totalAmount: _num(json['totalAmount']),
      workflowStatus: json['workflowStatus']?.toString(),
      supplierName: json['supplier'] is Map
          ? (json['supplier'] as Map)['name']?.toString()
          : null,
      createdAt: _parseDate(json['createdAt']),
      requiresFinanceApproval: json['requiresFinanceApproval'] == true,
      notes: json['notes']?.toString(),
      lines: linesRaw is List
          ? linesRaw
              .whereType<Map>()
              .map((e) => PurchaseOrderLineSummary.fromJson(
                    Map<String, dynamic>.from(e),
                  ))
              .toList()
          : const [],
      approvals: approvalsRaw is List
          ? approvalsRaw
              .whereType<Map>()
              .map((e) => PurchaseOrderApprovalSummary.fromJson(
                    Map<String, dynamic>.from(e),
                  ))
              .toList()
          : const [],
    );
  }
}

class PurchaseOrderLineSummary {
  const PurchaseOrderLineSummary({
    required this.id,
    required this.quantity,
    required this.unitCost,
    required this.totalCost,
    this.partNumber,
    this.partName,
    this.receivedQuantity,
  });

  final String id;
  final num quantity;
  final num unitCost;
  final num totalCost;
  final String? partNumber;
  final String? partName;
  final num? receivedQuantity;

  factory PurchaseOrderLineSummary.fromJson(Map<String, dynamic> json) {
    final part = json['sparePart'] ?? json['part'];
    return PurchaseOrderLineSummary(
      id: (json['id'] ?? '').toString(),
      quantity: _num(json['quantity']),
      unitCost: _num(json['unitCost']),
      totalCost: _num(json['totalCost']),
      receivedQuantity: json['receivedQuantity'] != null
          ? _num(json['receivedQuantity'])
          : null,
      partNumber: part is Map ? part['partNumber']?.toString() : null,
      partName: part is Map ? part['name']?.toString() : null,
    );
  }
}

class PurchaseOrderApprovalSummary {
  const PurchaseOrderApprovalSummary({
    required this.stage,
    required this.status,
    this.decidedAt,
  });

  final String stage;
  final String status;
  final DateTime? decidedAt;

  factory PurchaseOrderApprovalSummary.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderApprovalSummary(
      stage: (json['stage'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      decidedAt: _parseDate(json['decidedAt']),
    );
  }
}

class InventoryDashboardSummary {
  const InventoryDashboardSummary({
    this.onHand = 0,
    this.available = 0,
    this.lowStock = 0,
    this.outOfStock = 0,
    this.reliableValue = 0,
  });

  final num onHand;
  final num available;
  final num lowStock;
  final num outOfStock;
  final num reliableValue;

  factory InventoryDashboardSummary.fromJson(Map<String, dynamic> json) {
    return InventoryDashboardSummary(
      onHand: _num(json['onHand']),
      available: _num(json['available']),
      lowStock: _num(json['lowStock']),
      outOfStock: _num(json['outOfStock']),
      reliableValue: _num(json['reliableValue']),
    );
  }
}

class ErpStatusSummary {
  const ErpStatusSummary({
    this.provider,
    this.status,
    this.message,
    this.lastSyncAt,
    this.pendingCount,
    this.failedCount,
  });

  final String? provider;
  final String? status;
  final String? message;
  final DateTime? lastSyncAt;
  final int? pendingCount;
  final int? failedCount;

  factory ErpStatusSummary.fromJson(Map<String, dynamic> json) {
    return ErpStatusSummary(
      provider: json['provider']?.toString(),
      status: json['status']?.toString(),
      message: json['message']?.toString(),
      lastSyncAt: _parseDate(json['lastSyncAt'] ?? json['lastSuccessfulSyncAt']),
      pendingCount: _asInt(json['pendingCount']),
      failedCount: _asInt(json['failedCount']),
    );
  }
}

num _num(dynamic value) {
  if (value is num) return value;
  return num.tryParse('${value ?? ''}') ?? 0;
}

int? _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('${value ?? ''}');
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  return DateTime.tryParse(value.toString());
}
