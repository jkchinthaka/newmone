/// A single GPS sample from a vehicle.
class GpsPing {
  GpsPing({
    required this.vehicleId,
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    this.id,
    this.speed,
    this.heading,
    this.registrationNo,
    this.driverName,
    this.intelligence,
  });

  final String? id;
  final String vehicleId;
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final double? speed;
  final double? heading;
  final String? registrationNo;
  final String? driverName;
  final FleetIntelligence? intelligence;

  factory GpsPing.fromJson(Map<String, dynamic> json) {
    final vehicle = json['vehicle'];
    String? reg;
    String? driverName;
    if (vehicle is Map) {
      reg = vehicle['registrationNo']?.toString();
      final driver = vehicle['driver'];
      if (driver is Map) {
        final user = driver['user'];
        if (user is Map) {
          final f = (user['firstName'] ?? '').toString().trim();
          final l = (user['lastName'] ?? '').toString().trim();
          final full = [f, l].where((s) => s.isNotEmpty).join(' ');
          if (full.isNotEmpty) driverName = full;
        }
      }
    }
    final intel = json['intelligence'];
    return GpsPing(
      id: json['id']?.toString(),
      vehicleId: (json['vehicleId'] ?? '').toString(),
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0,
      timestamp: DateTime.tryParse((json['timestamp'] ?? '').toString()) ??
          DateTime.now(),
      speed: (json['speed'] as num?)?.toDouble(),
      heading: (json['heading'] as num?)?.toDouble(),
      registrationNo: reg,
      driverName: driverName,
      intelligence: intel is Map
          ? FleetIntelligence.fromJson(Map<String, dynamic>.from(intel))
          : null,
    );
  }
}

class FleetIntelligence {
  FleetIntelligence({
    required this.offline,
    required this.idle,
    required this.engineOn,
    this.fuelLevel,
    this.batteryVoltage,
    this.lastUpdateAt,
  });

  final bool offline;
  final bool idle;
  final bool engineOn;
  final double? fuelLevel;
  final double? batteryVoltage;
  final DateTime? lastUpdateAt;

  factory FleetIntelligence.fromJson(Map<String, dynamic> json) =>
      FleetIntelligence(
        offline: json['offline'] == true,
        idle: json['idle'] == true || json['idleStatus'] == true,
        engineOn: json['engineOn'] == true || json['engineStatus'] == true,
        fuelLevel: (json['fuelLevel'] as num?)?.toDouble(),
        batteryVoltage: (json['batteryVoltage'] as num?)?.toDouble(),
        lastUpdateAt:
            DateTime.tryParse((json['lastUpdateAt'] ?? '').toString()),
      );
}

class FleetAlert {
  FleetAlert({
    required this.id,
    required this.type,
    required this.severity,
    required this.vehicleId,
    required this.registrationNo,
    required this.message,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String severity;
  final String vehicleId;
  final String registrationNo;
  final String message;
  final DateTime createdAt;

  factory FleetAlert.fromJson(Map<String, dynamic> json) => FleetAlert(
        id: (json['id'] ?? '').toString(),
        type: (json['type'] ?? '').toString(),
        severity: (json['severity'] ?? 'INFO').toString(),
        vehicleId: (json['vehicleId'] ?? '').toString(),
        registrationNo: (json['registrationNo'] ?? '').toString(),
        message: (json['message'] ?? '').toString(),
        createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()) ??
            DateTime.now(),
      );
}
