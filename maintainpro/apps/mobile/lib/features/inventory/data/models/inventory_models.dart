class SparePart {
  SparePart({
    required this.id,
    required this.partNumber,
    required this.name,
    this.description,
    required this.category,
    required this.unit,
    required this.quantityInStock,
    required this.minimumStock,
    required this.reorderPoint,
    required this.unitCost,
    this.location,
    this.supplierId,
    this.supplierName,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String partNumber;
  final String name;
  final String? description;
  final String category;
  final String unit;
  final int quantityInStock;
  final int minimumStock;
  final int reorderPoint;
  final double unitCost;
  final String? location;
  final String? supplierId;
  final String? supplierName;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isLow => quantityInStock <= reorderPoint;
  bool get isCritical => quantityInStock <= minimumStock;

  factory SparePart.fromJson(Map<String, dynamic> json) {
    final supplier = json['supplier'] as Map<String, dynamic>?;
    return SparePart(
      id: json['id']?.toString() ?? '',
      partNumber: json['partNumber']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString(),
      category: json['category']?.toString() ?? 'GENERAL',
      unit: json['unit']?.toString() ?? 'pcs',
      quantityInStock: (json['quantityInStock'] as num?)?.toInt() ?? 0,
      minimumStock: (json['minimumStock'] as num?)?.toInt() ?? 0,
      reorderPoint: (json['reorderPoint'] as num?)?.toInt() ?? 0,
      unitCost: (json['unitCost'] as num?)?.toDouble() ?? 0,
      location: json['location']?.toString(),
      supplierId: json['supplierId']?.toString(),
      supplierName: supplier?['name']?.toString(),
      isActive: json['isActive'] as bool? ?? true,
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDate(json['updatedAt']) ?? DateTime.now(),
    );
  }
}

class StockMovement {
  StockMovement({
    required this.id,
    required this.partId,
    required this.type,
    required this.quantity,
    this.reference,
    this.notes,
    required this.createdAt,
  });

  final String id;
  final String partId;
  final String type;
  final int quantity;
  final String? reference;
  final String? notes;
  final DateTime createdAt;

  factory StockMovement.fromJson(Map<String, dynamic> json) {
    return StockMovement(
      id: json['id']?.toString() ?? '',
      partId: json['partId']?.toString() ?? '',
      type: json['type']?.toString() ?? 'IN',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      reference: json['reference']?.toString(),
      notes: json['notes']?.toString(),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
    );
  }
}

class InventoryPurchaseOrder {
  InventoryPurchaseOrder({
    required this.id,
    required this.poNumber,
    required this.supplierId,
    this.supplierName,
    required this.status,
    required this.orderDate,
    this.expectedDate,
    this.receivedDate,
    required this.totalAmount,
    this.notes,
    required this.createdAt,
  });

  final String id;
  final String poNumber;
  final String supplierId;
  final String? supplierName;
  final String status;
  final DateTime orderDate;
  final DateTime? expectedDate;
  final DateTime? receivedDate;
  final double totalAmount;
  final String? notes;
  final DateTime createdAt;

  factory InventoryPurchaseOrder.fromJson(Map<String, dynamic> json) {
    final supplier = json['supplier'] as Map<String, dynamic>?;
    return InventoryPurchaseOrder(
      id: json['id']?.toString() ?? '',
      poNumber: json['poNumber']?.toString() ?? '',
      supplierId: json['supplierId']?.toString() ?? '',
      supplierName: supplier?['name']?.toString(),
      status: json['status']?.toString() ?? 'PENDING',
      orderDate: _parseDate(json['orderDate']) ?? DateTime.now(),
      expectedDate: _parseDate(json['expectedDate']),
      receivedDate: _parseDate(json['receivedDate']),
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      notes: json['notes']?.toString(),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
    );
  }
}

DateTime? _parseDate(Object? raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  return DateTime.tryParse(raw.toString());
}
