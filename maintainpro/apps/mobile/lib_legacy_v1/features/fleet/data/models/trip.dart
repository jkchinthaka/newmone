import 'driver.dart';

class Trip {
  Trip({
    required this.id,
    required this.vehicleId,
    required this.driverId,
    required this.startLocation,
    required this.endLocation,
    required this.startMileage,
    required this.endMileage,
    required this.distance,
    required this.startTime,
    required this.status,
    this.endTime,
    this.purpose,
    this.notes,
    this.driver,
    this.vehicleRegistrationNo,
    this.createdAt,
  });

  final String id;
  final String vehicleId;
  final String driverId;
  final String startLocation;
  final String endLocation;
  final double startMileage;
  final double endMileage;
  final double distance;
  final DateTime startTime;
  final DateTime? endTime;
  final String status;
  final String? purpose;
  final String? notes;
  final Driver? driver;
  final String? vehicleRegistrationNo;
  final DateTime? createdAt;

  bool get isInProgress => status == 'IN_PROGRESS';
  bool get isCompleted => status == 'COMPLETED';
  bool get isCancelled => status == 'CANCELLED';

  Duration? get duration {
    final end = endTime ?? (isInProgress ? DateTime.now() : null);
    if (end == null) return null;
    return end.difference(startTime);
  }

  factory Trip.fromJson(Map<String, dynamic> json) {
    DateTime? d(dynamic v) =>
        v == null ? null : DateTime.tryParse(v.toString());
    final driverJson = json['driver'];
    final vehicle = json['vehicle'];
    String? reg;
    if (vehicle is Map) reg = vehicle['registrationNo']?.toString();
    return Trip(
      id: (json['id'] ?? '').toString(),
      vehicleId: (json['vehicleId'] ?? '').toString(),
      driverId: (json['driverId'] ?? '').toString(),
      startLocation: (json['startLocation'] ?? '').toString(),
      endLocation: (json['endLocation'] ?? '').toString(),
      startMileage: (json['startMileage'] as num?)?.toDouble() ?? 0,
      endMileage: (json['endMileage'] as num?)?.toDouble() ?? 0,
      distance: (json['distance'] as num?)?.toDouble() ?? 0,
      startTime: d(json['startTime']) ?? DateTime.now(),
      endTime: d(json['endTime']),
      status: (json['status'] ?? 'IN_PROGRESS').toString(),
      purpose: json['purpose']?.toString(),
      notes: json['notes']?.toString(),
      driver: driverJson is Map
          ? Driver.fromJson(Map<String, dynamic>.from(driverJson))
          : null,
      vehicleRegistrationNo: reg,
      createdAt: d(json['createdAt']),
    );
  }
}
