class UtilityMeter {
  UtilityMeter({
    required this.id,
    required this.meterNumber,
    required this.type,
    required this.location,
    this.description,
    required this.unit,
    required this.isActive,
    this.lastReadingValue,
    this.lastReadingDate,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String meterNumber;
  final String type;
  final String location;
  final String? description;
  final String unit;
  final bool isActive;
  final double? lastReadingValue;
  final DateTime? lastReadingDate;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory UtilityMeter.fromJson(Map<String, dynamic> json) {
    return UtilityMeter(
      id: json['id']?.toString() ?? '',
      meterNumber: json['meterNumber']?.toString() ?? '',
      type: json['type']?.toString() ?? 'ELECTRICITY',
      location: json['location']?.toString() ?? '',
      description: json['description']?.toString(),
      unit: json['unit']?.toString() ?? 'kWh',
      isActive: json['isActive'] as bool? ?? true,
      lastReadingValue: (json['lastReadingValue'] as num?)?.toDouble(),
      lastReadingDate: _date(json['lastReadingDate']),
      createdAt: _date(json['createdAt']) ?? DateTime.now(),
      updatedAt: _date(json['updatedAt']) ?? DateTime.now(),
    );
  }
}

class MeterReading {
  MeterReading({
    required this.id,
    required this.meterId,
    required this.readingDate,
    required this.readingValue,
    this.consumption,
    this.images,
    this.notes,
    required this.createdAt,
  });

  final String id;
  final String meterId;
  final DateTime readingDate;
  final double readingValue;
  final double? consumption;
  final List<String>? images;
  final String? notes;
  final DateTime createdAt;

  factory MeterReading.fromJson(Map<String, dynamic> json) {
    final imgs = json['images'];
    return MeterReading(
      id: json['id']?.toString() ?? '',
      meterId: json['meterId']?.toString() ?? '',
      readingDate: _date(json['readingDate']) ?? DateTime.now(),
      readingValue: (json['readingValue'] as num?)?.toDouble() ?? 0,
      consumption: (json['consumption'] as num?)?.toDouble(),
      images: imgs is List ? imgs.map((e) => e.toString()).toList() : null,
      notes: json['notes']?.toString(),
      createdAt: _date(json['createdAt']) ?? DateTime.now(),
    );
  }
}

class UtilityBill {
  UtilityBill({
    required this.id,
    required this.meterId,
    this.meterNumber,
    this.meterType,
    required this.billingPeriodStart,
    required this.billingPeriodEnd,
    required this.totalConsumption,
    required this.ratePerUnit,
    required this.baseCharge,
    required this.taxAmount,
    required this.totalAmount,
    this.dueDate,
    required this.isPaid,
    this.paidAt,
    this.notes,
    required this.createdAt,
  });

  final String id;
  final String meterId;
  final String? meterNumber;
  final String? meterType;
  final DateTime billingPeriodStart;
  final DateTime billingPeriodEnd;
  final double totalConsumption;
  final double ratePerUnit;
  final double baseCharge;
  final double taxAmount;
  final double totalAmount;
  final DateTime? dueDate;
  final bool isPaid;
  final DateTime? paidAt;
  final String? notes;
  final DateTime createdAt;

  bool get isOverdue =>
      !isPaid && dueDate != null && dueDate!.isBefore(DateTime.now());

  factory UtilityBill.fromJson(Map<String, dynamic> json) {
    final meter = json['meter'] as Map<String, dynamic>?;
    return UtilityBill(
      id: json['id']?.toString() ?? '',
      meterId: json['meterId']?.toString() ?? '',
      meterNumber: meter?['meterNumber']?.toString(),
      meterType: meter?['type']?.toString(),
      billingPeriodStart: _date(json['billingPeriodStart']) ?? DateTime.now(),
      billingPeriodEnd: _date(json['billingPeriodEnd']) ?? DateTime.now(),
      totalConsumption: (json['totalConsumption'] as num?)?.toDouble() ?? 0,
      ratePerUnit: (json['ratePerUnit'] as num?)?.toDouble() ?? 0,
      baseCharge: (json['baseCharge'] as num?)?.toDouble() ?? 0,
      taxAmount: (json['taxAmount'] as num?)?.toDouble() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      dueDate: _date(json['dueDate']),
      isPaid: json['isPaid'] as bool? ?? false,
      paidAt: _date(json['paidAt']),
      notes: json['notes']?.toString(),
      createdAt: _date(json['createdAt']) ?? DateTime.now(),
    );
  }
}

class UtilityAnalytics {
  UtilityAnalytics({
    required this.totalMeters,
    required this.activeMeters,
    required this.totalBills,
    required this.unpaidBills,
    required this.overdueBills,
    required this.totalUnpaidAmount,
    required this.totalSpentThisMonth,
    required this.byType,
  });

  final int totalMeters;
  final int activeMeters;
  final int totalBills;
  final int unpaidBills;
  final int overdueBills;
  final double totalUnpaidAmount;
  final double totalSpentThisMonth;
  final Map<String, double> byType;

  factory UtilityAnalytics.fromJson(Map<String, dynamic> json) {
    final byType = <String, double>{};
    final raw = json['byType'];
    if (raw is Map) {
      raw.forEach((k, v) {
        if (v is num) byType[k.toString()] = v.toDouble();
      });
    }
    return UtilityAnalytics(
      totalMeters: (json['totalMeters'] as num?)?.toInt() ?? 0,
      activeMeters: (json['activeMeters'] as num?)?.toInt() ?? 0,
      totalBills: (json['totalBills'] as num?)?.toInt() ?? 0,
      unpaidBills: (json['unpaidBills'] as num?)?.toInt() ?? 0,
      overdueBills: (json['overdueBills'] as num?)?.toInt() ?? 0,
      totalUnpaidAmount: (json['totalUnpaidAmount'] as num?)?.toDouble() ?? 0,
      totalSpentThisMonth:
          (json['totalSpentThisMonth'] as num?)?.toDouble() ?? 0,
      byType: byType,
    );
  }
}

DateTime? _date(Object? raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  return DateTime.tryParse(raw.toString());
}
