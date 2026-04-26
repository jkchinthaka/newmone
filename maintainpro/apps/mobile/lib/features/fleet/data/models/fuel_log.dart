class FuelLog {
  FuelLog({
    required this.id,
    required this.vehicleId,
    required this.date,
    required this.liters,
    required this.costPerLiter,
    required this.totalCost,
    required this.mileageAtFuel,
    this.fuelStation,
    this.receiptUrl,
    this.notes,
    this.vehicleRegistrationNo,
    this.createdAt,
  });

  final String id;
  final String vehicleId;
  final DateTime date;
  final double liters;
  final double costPerLiter;
  final double totalCost;
  final double mileageAtFuel;
  final String? fuelStation;
  final String? receiptUrl;
  final String? notes;
  final String? vehicleRegistrationNo;
  final DateTime? createdAt;

  factory FuelLog.fromJson(Map<String, dynamic> json) {
    DateTime? d(dynamic v) =>
        v == null ? null : DateTime.tryParse(v.toString());
    final vehicle = json['vehicle'];
    String? reg;
    if (vehicle is Map) {
      reg = vehicle['registrationNo']?.toString();
    }
    return FuelLog(
      id: (json['id'] ?? '').toString(),
      vehicleId: (json['vehicleId'] ?? '').toString(),
      date: d(json['date']) ?? DateTime.now(),
      liters: (json['liters'] as num?)?.toDouble() ?? 0,
      costPerLiter: (json['costPerLiter'] as num?)?.toDouble() ?? 0,
      totalCost: (json['totalCost'] as num?)?.toDouble() ?? 0,
      mileageAtFuel: (json['mileageAtFuel'] as num?)?.toDouble() ?? 0,
      fuelStation: json['fuelStation']?.toString(),
      receiptUrl: json['receiptUrl']?.toString(),
      notes: json['notes']?.toString(),
      vehicleRegistrationNo: reg,
      createdAt: d(json['createdAt']),
    );
  }
}

class FuelAnalytics {
  FuelAnalytics({
    required this.totalLiters,
    required this.totalCost,
    required this.avgCostPerLiter,
    required this.avgConsumption,
    this.distance,
  });

  /// Average L/100km if available.
  final double? avgConsumption;
  final double totalLiters;
  final double totalCost;
  final double avgCostPerLiter;
  final double? distance;

  factory FuelAnalytics.fromJson(Map<String, dynamic> json) => FuelAnalytics(
        totalLiters: (json['totalLiters'] as num?)?.toDouble() ?? 0,
        totalCost: (json['totalCost'] as num?)?.toDouble() ?? 0,
        avgCostPerLiter: (json['avgCostPerLiter'] as num?)?.toDouble() ?? 0,
        avgConsumption: (json['avgConsumption'] as num?)?.toDouble() ??
            (json['litersPer100Km'] as num?)?.toDouble(),
        distance: (json['distance'] as num?)?.toDouble(),
      );
}
