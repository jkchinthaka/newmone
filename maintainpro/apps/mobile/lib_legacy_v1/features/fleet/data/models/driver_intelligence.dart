class DriverIntelligenceProfile {
  DriverIntelligenceProfile({
    required this.id,
    required this.displayName,
    required this.driverScore,
    required this.riskLevel,
    required this.rankingScore,
    required this.licenseNumber,
    required this.licenseClass,
    required this.licenseExpiry,
    required this.licenseValid,
    required this.eligibility,
    required this.inputs,
    required this.components,
    required this.summary,
    required this.assignedVehicles,
    this.departmentName,
    this.licenseExpiresInDays,
  });

  final String id;
  final String displayName;
  final int driverScore;
  final String riskLevel;
  final int rankingScore;
  final String licenseNumber;
  final String licenseClass;
  final DateTime licenseExpiry;
  final bool licenseValid;
  final int? licenseExpiresInDays;
  final String? departmentName;
  final DriverEligibility eligibility;
  final DriverIntelligenceInputs inputs;
  final DriverIntelligenceComponents components;
  final DriverIntelligenceSummary summary;
  final List<AssignedVehicleSnapshot> assignedVehicles;

  factory DriverIntelligenceProfile.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic value) =>
        value == null ? null : DateTime.tryParse(value.toString());
    final license = Map<String, dynamic>.from((json['license'] as Map?) ?? const {});
    final department = json['department'];
    return DriverIntelligenceProfile(
      id: (json['id'] ?? '').toString(),
      displayName: (json['displayName'] ?? 'Driver').toString(),
      driverScore: (json['driverScore'] as num?)?.toInt() ?? 0,
      riskLevel: (json['riskLevel'] ?? 'LOW').toString(),
      rankingScore: (json['rankingScore'] as num?)?.toInt() ?? 0,
      licenseNumber: (license['number'] ?? '').toString(),
      licenseClass: (license['licenseClass'] ?? '').toString(),
      licenseExpiry: parseDate(license['expiry']) ?? DateTime.now(),
      licenseValid: license['valid'] == true,
      licenseExpiresInDays: (license['expiresInDays'] as num?)?.toInt(),
      departmentName: department is Map ? department['name']?.toString() : null,
      eligibility: DriverEligibility.fromJson(
        Map<String, dynamic>.from((json['eligibility'] as Map?) ?? const {}),
      ),
      inputs: DriverIntelligenceInputs.fromJson(
        Map<String, dynamic>.from((json['inputs'] as Map?) ?? const {}),
      ),
      components: DriverIntelligenceComponents.fromJson(
        Map<String, dynamic>.from((json['components'] as Map?) ?? const {}),
      ),
      summary: DriverIntelligenceSummary.fromJson(
        Map<String, dynamic>.from((json['summary'] as Map?) ?? const {}),
      ),
      assignedVehicles: ((json['assignedVehicles'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => AssignedVehicleSnapshot.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(),
    );
  }
}

class DriverEligibility {
  DriverEligibility({
    required this.eligible,
    required this.reasons,
    required this.reviewedScore,
    required this.minimumVehicleCareScore,
    required this.vehicleCareScore,
  });

  final bool eligible;
  final List<String> reasons;
  final double reviewedScore;
  final double minimumVehicleCareScore;
  final double vehicleCareScore;

  factory DriverEligibility.fromJson(Map<String, dynamic> json) =>
      DriverEligibility(
        eligible: json['eligible'] == true,
        reasons: ((json['reasons'] as List?) ?? const [])
            .map((item) => item.toString())
            .toList(),
        reviewedScore: (json['reviewedScore'] as num?)?.toDouble() ?? 0,
        minimumVehicleCareScore:
            (json['minimumVehicleCareScore'] as num?)?.toDouble() ?? 0,
        vehicleCareScore: (json['vehicleCareScore'] as num?)?.toDouble() ?? 0,
      );
}

class DriverIntelligenceInputs {
  DriverIntelligenceInputs({
    required this.trainingStatus,
    required this.pendingDisciplinaryIssues,
    this.trainingCompletedAt,
    this.trainingExpiry,
    this.supervisorReviewScore,
  });

  final String trainingStatus;
  final int pendingDisciplinaryIssues;
  final DateTime? trainingCompletedAt;
  final DateTime? trainingExpiry;
  final double? supervisorReviewScore;

  factory DriverIntelligenceInputs.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic value) =>
        value == null ? null : DateTime.tryParse(value.toString());
    return DriverIntelligenceInputs(
      trainingStatus: (json['trainingStatus'] ?? 'NOT_STARTED').toString(),
      pendingDisciplinaryIssues:
          (json['pendingDisciplinaryIssues'] as num?)?.toInt() ?? 0,
      trainingCompletedAt: parseDate(json['trainingCompletedAt']),
      trainingExpiry: parseDate(json['trainingExpiry']),
      supervisorReviewScore:
          (json['supervisorReviewScore'] as num?)?.toDouble(),
    );
  }
}

class DriverIntelligenceComponents {
  DriverIntelligenceComponents({
    required this.safetyScore,
    required this.vehicleCareScore,
    required this.tripReliabilityScore,
    required this.fuelEfficiencyScore,
    required this.complianceReadinessScore,
    required this.supervisorReviewScore,
  });

  final double safetyScore;
  final double vehicleCareScore;
  final double tripReliabilityScore;
  final double fuelEfficiencyScore;
  final double complianceReadinessScore;
  final double supervisorReviewScore;

  factory DriverIntelligenceComponents.fromJson(Map<String, dynamic> json) =>
      DriverIntelligenceComponents(
        safetyScore: (json['safetyScore'] as num?)?.toDouble() ?? 0,
        vehicleCareScore: (json['vehicleCareScore'] as num?)?.toDouble() ?? 0,
        tripReliabilityScore:
            (json['tripReliabilityScore'] as num?)?.toDouble() ?? 0,
        fuelEfficiencyScore:
            (json['fuelEfficiencyScore'] as num?)?.toDouble() ?? 0,
        complianceReadinessScore:
            (json['complianceReadinessScore'] as num?)?.toDouble() ?? 0,
        supervisorReviewScore:
            (json['supervisorReviewScore'] as num?)?.toDouble() ?? 0,
      );
}

class DriverIntelligenceSummary {
  DriverIntelligenceSummary({
    required this.driverFaultAccidents,
    required this.driverRelatedFines,
    required this.organizationFines,
    required this.documentRelatedOrganizationFines,
    required this.vehicleDefectFines,
    required this.abnormalFuelUsageCount,
    required this.totalTrips,
    required this.completedTrips,
    required this.correctiveWorkOrders,
    required this.overdueAssignedVehicles,
    required this.nonCompliantAssignedVehicles,
  });

  final int driverFaultAccidents;
  final int driverRelatedFines;
  final int organizationFines;
  final int documentRelatedOrganizationFines;
  final int vehicleDefectFines;
  final int abnormalFuelUsageCount;
  final int totalTrips;
  final int completedTrips;
  final int correctiveWorkOrders;
  final int overdueAssignedVehicles;
  final int nonCompliantAssignedVehicles;

  factory DriverIntelligenceSummary.fromJson(Map<String, dynamic> json) =>
      DriverIntelligenceSummary(
        driverFaultAccidents:
            (json['driverFaultAccidents'] as num?)?.toInt() ?? 0,
        driverRelatedFines:
            (json['driverRelatedFines'] as num?)?.toInt() ?? 0,
        organizationFines:
            (json['organizationFines'] as num?)?.toInt() ?? 0,
        documentRelatedOrganizationFines:
            (json['documentRelatedOrganizationFines'] as num?)?.toInt() ?? 0,
        vehicleDefectFines:
            (json['vehicleDefectFines'] as num?)?.toInt() ?? 0,
        abnormalFuelUsageCount:
            (json['abnormalFuelUsageCount'] as num?)?.toInt() ?? 0,
        totalTrips: (json['totalTrips'] as num?)?.toInt() ?? 0,
        completedTrips: (json['completedTrips'] as num?)?.toInt() ?? 0,
        correctiveWorkOrders:
            (json['correctiveWorkOrders'] as num?)?.toInt() ?? 0,
        overdueAssignedVehicles:
            (json['overdueAssignedVehicles'] as num?)?.toInt() ?? 0,
        nonCompliantAssignedVehicles:
            (json['nonCompliantAssignedVehicles'] as num?)?.toInt() ?? 0,
      );
}

class AssignedVehicleSnapshot {
  AssignedVehicleSnapshot({
    required this.id,
    required this.registrationNo,
    required this.vehicleModel,
    required this.status,
    required this.complianceStatus,
    required this.serviceStatus,
    required this.currentMileage,
    required this.type,
  });

  final String id;
  final String registrationNo;
  final String vehicleModel;
  final String status;
  final String complianceStatus;
  final String serviceStatus;
  final double currentMileage;
  final String type;

  factory AssignedVehicleSnapshot.fromJson(Map<String, dynamic> json) =>
      AssignedVehicleSnapshot(
        id: (json['id'] ?? '').toString(),
        registrationNo: (json['registrationNo'] ?? '').toString(),
        vehicleModel: (json['vehicleModel'] ?? '').toString(),
        status: (json['status'] ?? '').toString(),
        complianceStatus: (json['complianceStatus'] ?? '').toString(),
        serviceStatus: (json['serviceStatus'] ?? '').toString(),
        currentMileage: (json['currentMileage'] as num?)?.toDouble() ?? 0,
        type: (json['type'] ?? '').toString(),
      );
}