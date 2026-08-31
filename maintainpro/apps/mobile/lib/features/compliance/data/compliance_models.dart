/// Compliance / safety read models from Nest.
library;

class ComplianceSummary {
  const ComplianceSummary({
    required this.total,
    required this.compliant,
    required this.attention,
    required this.nonCompliant,
  });

  final int total;
  final int compliant;
  final int attention;
  final int nonCompliant;

  factory ComplianceSummary.fromJson(Map<String, dynamic> json) {
    return ComplianceSummary(
      total: json['total'] is num ? (json['total'] as num).toInt() : 0,
      compliant: json['compliant'] is num ? (json['compliant'] as num).toInt() : 0,
      attention: json['attention'] is num ? (json['attention'] as num).toInt() : 0,
      nonCompliant:
          json['nonCompliant'] is num ? (json['nonCompliant'] as num).toInt() : 0,
    );
  }
}

class VehicleDocumentSummary {
  const VehicleDocumentSummary({
    required this.id,
    required this.documentType,
    required this.status,
    required this.expiryDate,
    this.documentNumber,
    this.vehicleId,
    this.vehicleRegistration,
    this.issuedDate,
    this.issuingAuthority,
    this.fileUrl,
    this.notes,
  });

  final String id;
  final String documentType;
  final String status;
  final DateTime expiryDate;
  final String? documentNumber;
  final String? vehicleId;
  final String? vehicleRegistration;
  final DateTime? issuedDate;
  final String? issuingAuthority;
  final String? fileUrl;
  final String? notes;

  bool get isExpired => expiryDate.isBefore(DateTime.now());

  factory VehicleDocumentSummary.fromJson(Map<String, dynamic> json) {
    final vehicle = json['vehicle'];
    return VehicleDocumentSummary(
      id: (json['id'] ?? '').toString(),
      documentType: (json['documentType'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      expiryDate: DateTime.tryParse('${json['expiryDate'] ?? ''}') ?? DateTime.now(),
      documentNumber: json['documentNumber']?.toString(),
      vehicleId: json['vehicleId']?.toString() ??
          (vehicle is Map ? vehicle['id']?.toString() : null),
      vehicleRegistration: vehicle is Map
          ? vehicle['registrationNo']?.toString()
          : null,
      issuedDate: DateTime.tryParse('${json['issuedDate'] ?? ''}'),
      issuingAuthority: json['issuingAuthority']?.toString(),
      fileUrl: json['fileUrl']?.toString(),
      notes: json['notes']?.toString(),
    );
  }
}

class AccidentSummary {
  const AccidentSummary({
    required this.id,
    required this.reportNumber,
    required this.status,
    required this.severity,
    required this.location,
    required this.description,
    this.occurredAt,
    this.vehicleId,
    this.vehicleRegistration,
    this.workOrderId,
    this.workOrderNumber,
  });

  final String id;
  final String reportNumber;
  final String status;
  final String severity;
  final String location;
  final String description;
  final DateTime? occurredAt;
  final String? vehicleId;
  final String? vehicleRegistration;
  final String? workOrderId;
  final String? workOrderNumber;

  factory AccidentSummary.fromJson(Map<String, dynamic> json) {
    final vehicle = json['vehicle'];
    final wo = json['workOrder'] ?? (json['workOrders'] is List && (json['workOrders'] as List).isNotEmpty
        ? (json['workOrders'] as List).first
        : null);
    return AccidentSummary(
      id: (json['id'] ?? '').toString(),
      reportNumber: (json['reportNumber'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      severity: (json['severity'] ?? '').toString(),
      location: (json['location'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      occurredAt: DateTime.tryParse('${json['occurredAt'] ?? ''}'),
      vehicleId: json['vehicleId']?.toString() ??
          (vehicle is Map ? vehicle['id']?.toString() : null),
      vehicleRegistration: vehicle is Map
          ? vehicle['registrationNo']?.toString()
          : null,
      workOrderId: wo is Map ? wo['id']?.toString() : null,
      workOrderNumber: wo is Map ? wo['woNumber']?.toString() : null,
    );
  }
}

class InsuranceClaimSummary {
  const InsuranceClaimSummary({
    required this.id,
    required this.claimNumber,
    required this.status,
    required this.claimAmount,
    this.insurerName,
    this.policyNumber,
    this.approvedAmount,
    this.vehicleId,
    this.vehicleRegistration,
    this.accidentId,
    this.accidentReportNumber,
  });

  final String id;
  final String claimNumber;
  final String status;
  final num claimAmount;
  final String? insurerName;
  final String? policyNumber;
  final num? approvedAmount;
  final String? vehicleId;
  final String? vehicleRegistration;
  final String? accidentId;
  final String? accidentReportNumber;

  factory InsuranceClaimSummary.fromJson(Map<String, dynamic> json) {
    final vehicle = json['vehicle'];
    final accident = json['accident'];
    return InsuranceClaimSummary(
      id: (json['id'] ?? '').toString(),
      claimNumber: (json['claimNumber'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      claimAmount: json['claimAmount'] is num
          ? json['claimAmount'] as num
          : num.tryParse('${json['claimAmount'] ?? 0}') ?? 0,
      insurerName: json['insurerName']?.toString(),
      policyNumber: json['policyNumber']?.toString(),
      approvedAmount: json['approvedAmount'] is num ? json['approvedAmount'] as num : null,
      vehicleId: json['vehicleId']?.toString() ??
          (vehicle is Map ? vehicle['id']?.toString() : null),
      vehicleRegistration: vehicle is Map
          ? vehicle['registrationNo']?.toString()
          : null,
      accidentId: json['accidentId']?.toString() ??
          (accident is Map ? accident['id']?.toString() : null),
      accidentReportNumber: accident is Map
          ? accident['reportNumber']?.toString()
          : null,
    );
  }
}

class TrafficFineSummary {
  const TrafficFineSummary({
    required this.id,
    required this.offense,
    required this.fineAmount,
    required this.paymentStatus,
    this.fineDate,
    this.location,
    this.responsibility,
    this.vehicleId,
    this.vehicleRegistration,
    this.workOrderId,
  });

  final String id;
  final String offense;
  final num fineAmount;
  final String paymentStatus;
  final DateTime? fineDate;
  final String? location;
  final String? responsibility;
  final String? vehicleId;
  final String? vehicleRegistration;
  final String? workOrderId;

  factory TrafficFineSummary.fromJson(Map<String, dynamic> json) {
    final vehicle = json['vehicle'];
    return TrafficFineSummary(
      id: (json['id'] ?? '').toString(),
      offense: (json['offense'] ?? '').toString(),
      fineAmount: json['fineAmount'] is num
          ? json['fineAmount'] as num
          : num.tryParse('${json['fineAmount'] ?? 0}') ?? 0,
      paymentStatus: (json['paymentStatus'] ?? '').toString(),
      fineDate: DateTime.tryParse('${json['fineDate'] ?? ''}'),
      location: json['location']?.toString(),
      responsibility: json['responsibility']?.toString(),
      vehicleId: json['vehicleId']?.toString() ??
          (vehicle is Map ? vehicle['id']?.toString() : null),
      vehicleRegistration: vehicle is Map
          ? vehicle['registrationNo']?.toString()
          : null,
      workOrderId: json['workOrderId']?.toString(),
    );
  }
}
