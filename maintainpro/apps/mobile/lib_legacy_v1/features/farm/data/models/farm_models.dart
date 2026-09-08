// Farm domain models. All Mongo ObjectIds parsed as String.

DateTime? _date(Object? v) {
  if (v == null) return null;
  if (v is DateTime) return v;
  return DateTime.tryParse(v.toString());
}

double? _double(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

int? _int(Object? v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

String _str(Object? v) => v?.toString() ?? '';

List<String> _strList(Object? v) {
  if (v is List) return v.map((e) => e.toString()).toList();
  return const [];
}

Map<String, double> _numMap(Object? v) {
  if (v is Map) {
    return v.map(
      (k, val) => MapEntry(k.toString(), _double(val) ?? 0.0),
    );
  }
  return const {};
}

class FarmField {
  FarmField({
    required this.id,
    required this.name,
    this.blockCode,
    required this.areaHectares,
    required this.soilType,
    this.irrigationZone,
    required this.status,
    required this.createdAt,
  });
  final String id;
  final String name;
  final String? blockCode;
  final double areaHectares;
  final String soilType;
  final String? irrigationZone;
  final String status;
  final DateTime createdAt;

  factory FarmField.fromJson(Map<String, dynamic> j) => FarmField(
        id: _str(j['id']),
        name: _str(j['name']),
        blockCode: j['blockCode']?.toString(),
        areaHectares: _double(j['areaHectares']) ?? 0,
        soilType: _str(j['soilType']),
        irrigationZone: j['irrigationZone']?.toString(),
        status: _str(j['status']),
        createdAt: _date(j['createdAt']) ?? DateTime.now(),
      );
}

class CropCycle {
  CropCycle({
    required this.id,
    required this.fieldId,
    required this.cropType,
    this.variety,
    required this.plantingDate,
    this.expectedHarvestDate,
    this.actualHarvestDate,
    this.expectedYieldKg,
    this.actualYieldKg,
    this.seedCostLkr,
    this.fertilizerCostLkr,
    this.pesticideCostLkr,
    this.laborCostLkr,
    this.irrigationCostLkr,
    this.otherCostLkr,
    this.revenueLkr,
    required this.status,
    this.notes,
  });
  final String id;
  final String fieldId;
  final String cropType;
  final String? variety;
  final DateTime plantingDate;
  final DateTime? expectedHarvestDate;
  final DateTime? actualHarvestDate;
  final double? expectedYieldKg;
  final double? actualYieldKg;
  final double? seedCostLkr;
  final double? fertilizerCostLkr;
  final double? pesticideCostLkr;
  final double? laborCostLkr;
  final double? irrigationCostLkr;
  final double? otherCostLkr;
  final double? revenueLkr;
  final String status;
  final String? notes;

  double get totalCost =>
      (seedCostLkr ?? 0) +
      (fertilizerCostLkr ?? 0) +
      (pesticideCostLkr ?? 0) +
      (laborCostLkr ?? 0) +
      (irrigationCostLkr ?? 0) +
      (otherCostLkr ?? 0);

  double get profit => (revenueLkr ?? 0) - totalCost;

  factory CropCycle.fromJson(Map<String, dynamic> j) => CropCycle(
        id: _str(j['id']),
        fieldId: _str(j['fieldId']),
        cropType: _str(j['cropType']),
        variety: j['variety']?.toString(),
        plantingDate: _date(j['plantingDate']) ?? DateTime.now(),
        expectedHarvestDate: _date(j['expectedHarvestDate']),
        actualHarvestDate: _date(j['actualHarvestDate']),
        expectedYieldKg: _double(j['expectedYieldKg']),
        actualYieldKg: _double(j['actualYieldKg']),
        seedCostLkr: _double(j['seedCostLkr']),
        fertilizerCostLkr: _double(j['fertilizerCostLkr']),
        pesticideCostLkr: _double(j['pesticideCostLkr']),
        laborCostLkr: _double(j['laborCostLkr']),
        irrigationCostLkr: _double(j['irrigationCostLkr']),
        otherCostLkr: _double(j['otherCostLkr']),
        revenueLkr: _double(j['revenueLkr']),
        status: _str(j['status']),
        notes: j['notes']?.toString(),
      );
}

class HarvestRecord {
  HarvestRecord({
    required this.id,
    required this.cropCycleId,
    required this.harvestDate,
    required this.quantityKg,
    required this.qualityGrade,
    this.moistureLevel,
    this.storageLocation,
    this.batchCode,
    this.pricePerKgLkr,
    this.totalValueLkr,
    this.buyerName,
    this.notes,
  });
  final String id;
  final String cropCycleId;
  final DateTime harvestDate;
  final double quantityKg;
  final String qualityGrade;
  final double? moistureLevel;
  final String? storageLocation;
  final String? batchCode;
  final double? pricePerKgLkr;
  final double? totalValueLkr;
  final String? buyerName;
  final String? notes;

  factory HarvestRecord.fromJson(Map<String, dynamic> j) => HarvestRecord(
        id: _str(j['id']),
        cropCycleId: _str(j['cropCycleId']),
        harvestDate: _date(j['harvestDate']) ?? DateTime.now(),
        quantityKg: _double(j['quantityKg']) ?? 0,
        qualityGrade: _str(j['qualityGrade']),
        moistureLevel: _double(j['moistureLevel']),
        storageLocation: j['storageLocation']?.toString(),
        batchCode: j['batchCode']?.toString(),
        pricePerKgLkr: _double(j['pricePerKgLkr']),
        totalValueLkr: _double(j['totalValueLkr']),
        buyerName: j['buyerName']?.toString(),
        notes: j['notes']?.toString(),
      );
}

class LivestockAnimal {
  LivestockAnimal({
    required this.id,
    required this.tagNumber,
    required this.species,
    this.breed,
    required this.gender,
    this.dateOfBirth,
    this.purchaseDate,
    this.purchasePriceLkr,
    this.weightKg,
    required this.status,
    this.qrCodeUrl,
  });
  final String id;
  final String tagNumber;
  final String species;
  final String? breed;
  final String gender;
  final DateTime? dateOfBirth;
  final DateTime? purchaseDate;
  final double? purchasePriceLkr;
  final double? weightKg;
  final String status;
  final String? qrCodeUrl;

  factory LivestockAnimal.fromJson(Map<String, dynamic> j) => LivestockAnimal(
        id: _str(j['id']),
        tagNumber: _str(j['tagNumber']),
        species: _str(j['species']),
        breed: j['breed']?.toString(),
        gender: _str(j['gender']),
        dateOfBirth: _date(j['dateOfBirth']),
        purchaseDate: _date(j['purchaseDate']),
        purchasePriceLkr: _double(j['purchasePriceLkr']),
        weightKg: _double(j['weightKg']),
        status: _str(j['status']),
        qrCodeUrl: j['qrCodeUrl']?.toString(),
      );
}

class AnimalHealthRecord {
  AnimalHealthRecord({
    required this.id,
    required this.animalId,
    required this.date,
    required this.type,
    required this.description,
    this.vetName,
    this.medicineName,
    this.dosage,
    this.costLkr,
    this.nextDueDate,
    this.notes,
  });
  final String id;
  final String animalId;
  final DateTime date;
  final String type;
  final String description;
  final String? vetName;
  final String? medicineName;
  final String? dosage;
  final double? costLkr;
  final DateTime? nextDueDate;
  final String? notes;

  factory AnimalHealthRecord.fromJson(Map<String, dynamic> j) =>
      AnimalHealthRecord(
        id: _str(j['id']),
        animalId: _str(j['animalId']),
        date: _date(j['date']) ?? DateTime.now(),
        type: _str(j['type']),
        description: _str(j['description']),
        vetName: j['vetName']?.toString(),
        medicineName: j['medicineName']?.toString(),
        dosage: j['dosage']?.toString(),
        costLkr: _double(j['costLkr']),
        nextDueDate: _date(j['nextDueDate']),
        notes: j['notes']?.toString(),
      );
}

class AnimalProductionLog {
  AnimalProductionLog({
    required this.id,
    required this.animalId,
    required this.date,
    required this.type,
    this.quantityLiters,
    this.quantityCount,
    this.quantityKg,
    this.qualityGrade,
    this.notes,
  });
  final String id;
  final String animalId;
  final DateTime date;
  final String type;
  final double? quantityLiters;
  final int? quantityCount;
  final double? quantityKg;
  final String? qualityGrade;
  final String? notes;

  factory AnimalProductionLog.fromJson(Map<String, dynamic> j) =>
      AnimalProductionLog(
        id: _str(j['id']),
        animalId: _str(j['animalId']),
        date: _date(j['date']) ?? DateTime.now(),
        type: _str(j['type']),
        quantityLiters: _double(j['quantityLiters']),
        quantityCount: _int(j['quantityCount']),
        quantityKg: _double(j['quantityKg']),
        qualityGrade: j['qualityGrade']?.toString(),
        notes: j['notes']?.toString(),
      );
}

class FeedingLog {
  FeedingLog({
    required this.id,
    this.animalId,
    this.groupLabel,
    required this.feedType,
    required this.quantityKg,
    this.costLkr,
    required this.date,
    this.notes,
  });
  final String id;
  final String? animalId;
  final String? groupLabel;
  final String feedType;
  final double quantityKg;
  final double? costLkr;
  final DateTime date;
  final String? notes;

  factory FeedingLog.fromJson(Map<String, dynamic> j) => FeedingLog(
        id: _str(j['id']),
        animalId: j['animalId']?.toString(),
        groupLabel: j['groupLabel']?.toString(),
        feedType: _str(j['feedType']),
        quantityKg: _double(j['quantityKg']) ?? 0,
        costLkr: _double(j['costLkr']),
        date: _date(j['date']) ?? DateTime.now(),
        notes: j['notes']?.toString(),
      );
}

class IrrigationLog {
  IrrigationLog({
    required this.id,
    required this.fieldId,
    required this.startTime,
    this.endTime,
    this.durationMinutes,
    this.waterUsedLiters,
    required this.method,
    this.costLkr,
    this.notes,
  });
  final String id;
  final String fieldId;
  final DateTime startTime;
  final DateTime? endTime;
  final int? durationMinutes;
  final double? waterUsedLiters;
  final String method;
  final double? costLkr;
  final String? notes;

  factory IrrigationLog.fromJson(Map<String, dynamic> j) => IrrigationLog(
        id: _str(j['id']),
        fieldId: _str(j['fieldId']),
        startTime: _date(j['startTime']) ?? DateTime.now(),
        endTime: _date(j['endTime']),
        durationMinutes: _int(j['durationMinutes']),
        waterUsedLiters: _double(j['waterUsedLiters']),
        method: _str(j['method']),
        costLkr: _double(j['costLkr']),
        notes: j['notes']?.toString(),
      );
}

class SprayLog {
  SprayLog({
    required this.id,
    required this.fieldId,
    this.cropCycleId,
    required this.date,
    required this.chemicalName,
    required this.chemicalType,
    this.targetPestDisease,
    this.dosagePerHectare,
    this.totalQuantityUsed,
    required this.unit,
    this.costLkr,
    this.weatherAtTime,
    this.reEntryIntervalHrs,
    this.priorHarvestDays,
    required this.complianceFlag,
    this.notes,
  });
  final String id;
  final String fieldId;
  final String? cropCycleId;
  final DateTime date;
  final String chemicalName;
  final String chemicalType;
  final String? targetPestDisease;
  final double? dosagePerHectare;
  final double? totalQuantityUsed;
  final String unit;
  final double? costLkr;
  final String? weatherAtTime;
  final int? reEntryIntervalHrs;
  final int? priorHarvestDays;
  final bool complianceFlag;
  final String? notes;

  factory SprayLog.fromJson(Map<String, dynamic> j) => SprayLog(
        id: _str(j['id']),
        fieldId: _str(j['fieldId']),
        cropCycleId: j['cropCycleId']?.toString(),
        date: _date(j['date']) ?? DateTime.now(),
        chemicalName: _str(j['chemicalName']),
        chemicalType: _str(j['chemicalType']),
        targetPestDisease: j['targetPestDisease']?.toString(),
        dosagePerHectare: _double(j['dosagePerHectare']),
        totalQuantityUsed: _double(j['totalQuantityUsed']),
        unit: _str(j['unit']),
        costLkr: _double(j['costLkr']),
        weatherAtTime: j['weatherAtTime']?.toString(),
        reEntryIntervalHrs: _int(j['reEntryIntervalHrs']),
        priorHarvestDays: _int(j['priorHarvestDays']),
        complianceFlag: j['complianceFlag'] == true,
        notes: j['notes']?.toString(),
      );
}

class SoilTest {
  SoilTest({
    required this.id,
    required this.fieldId,
    required this.testDate,
    this.ph,
    this.nitrogenPpm,
    this.phosphorusPpm,
    this.potassiumPpm,
    this.organicMatterPct,
    this.recommendation,
    this.labName,
    this.reportUrl,
  });
  final String id;
  final String fieldId;
  final DateTime testDate;
  final double? ph;
  final double? nitrogenPpm;
  final double? phosphorusPpm;
  final double? potassiumPpm;
  final double? organicMatterPct;
  final String? recommendation;
  final String? labName;
  final String? reportUrl;

  factory SoilTest.fromJson(Map<String, dynamic> j) => SoilTest(
        id: _str(j['id']),
        fieldId: _str(j['fieldId']),
        testDate: _date(j['testDate']) ?? DateTime.now(),
        ph: _double(j['ph']),
        nitrogenPpm: _double(j['nitrogenPpm']),
        phosphorusPpm: _double(j['phosphorusPpm']),
        potassiumPpm: _double(j['potassiumPpm']),
        organicMatterPct: _double(j['organicMatterPct']),
        recommendation: j['recommendation']?.toString(),
        labName: j['labName']?.toString(),
        reportUrl: j['reportUrl']?.toString(),
      );
}

class WeatherLog {
  WeatherLog({
    required this.id,
    required this.recordedAt,
    this.temperatureC,
    this.rainfallMm,
    this.humidityPct,
    this.windSpeedKmh,
    this.condition,
    required this.source,
    required this.alertTriggered,
    this.alertType,
  });
  final String id;
  final DateTime recordedAt;
  final double? temperatureC;
  final double? rainfallMm;
  final double? humidityPct;
  final double? windSpeedKmh;
  final String? condition;
  final String source;
  final bool alertTriggered;
  final String? alertType;

  factory WeatherLog.fromJson(Map<String, dynamic> j) => WeatherLog(
        id: _str(j['id']),
        recordedAt: _date(j['recordedAt']) ?? DateTime.now(),
        temperatureC: _double(j['temperatureC']),
        rainfallMm: _double(j['rainfallMm']),
        humidityPct: _double(j['humidityPct']),
        windSpeedKmh: _double(j['windSpeedKmh']),
        condition: j['condition']?.toString(),
        source: _str(j['source']),
        alertTriggered: j['alertTriggered'] == true,
        alertType: j['alertType']?.toString(),
      );
}

class FarmWorker {
  FarmWorker({
    required this.id,
    required this.name,
    this.nic,
    this.phone,
    this.address,
    required this.workerType,
    this.dailyWageLkr,
    required this.skillTags,
    required this.status,
    this.qrCodeUrl,
  });
  final String id;
  final String name;
  final String? nic;
  final String? phone;
  final String? address;
  final String workerType;
  final double? dailyWageLkr;
  final List<String> skillTags;
  final String status;
  final String? qrCodeUrl;

  factory FarmWorker.fromJson(Map<String, dynamic> j) => FarmWorker(
        id: _str(j['id']),
        name: _str(j['name']),
        nic: j['nic']?.toString(),
        phone: j['phone']?.toString(),
        address: j['address']?.toString(),
        workerType: _str(j['workerType']),
        dailyWageLkr: _double(j['dailyWageLkr']),
        skillTags: _strList(j['skillTags']),
        status: _str(j['status']),
        qrCodeUrl: j['qrCodeUrl']?.toString(),
      );
}

class AttendanceLog {
  AttendanceLog({
    required this.id,
    required this.workerId,
    this.workerName,
    required this.date,
    required this.status,
    this.checkInTime,
    this.checkOutTime,
    this.hoursWorked,
    this.taskArea,
    this.wageLkr,
    this.notes,
  });
  final String id;
  final String workerId;
  final String? workerName;
  final DateTime date;
  final String status;
  final DateTime? checkInTime;
  final DateTime? checkOutTime;
  final double? hoursWorked;
  final String? taskArea;
  final double? wageLkr;
  final String? notes;

  factory AttendanceLog.fromJson(Map<String, dynamic> j) {
    String? wn;
    final w = j['worker'];
    if (w is Map) {
      wn = w['name']?.toString();
    }
    return AttendanceLog(
      id: _str(j['id']),
      workerId: _str(j['workerId']),
      workerName: wn,
      date: _date(j['date']) ?? DateTime.now(),
      status: _str(j['status']),
      checkInTime: _date(j['checkInTime']),
      checkOutTime: _date(j['checkOutTime']),
      hoursWorked: _double(j['hoursWorked']),
      taskArea: j['taskArea']?.toString(),
      wageLkr: _double(j['wageLkr']),
      notes: j['notes']?.toString(),
    );
  }
}

class FarmExpense {
  FarmExpense({
    required this.id,
    required this.date,
    required this.category,
    required this.description,
    required this.amountLkr,
    this.cropCycleId,
    this.fieldId,
    required this.paymentMethod,
    this.notes,
  });
  final String id;
  final DateTime date;
  final String category;
  final String description;
  final double amountLkr;
  final String? cropCycleId;
  final String? fieldId;
  final String paymentMethod;
  final String? notes;

  factory FarmExpense.fromJson(Map<String, dynamic> j) => FarmExpense(
        id: _str(j['id']),
        date: _date(j['date']) ?? DateTime.now(),
        category: _str(j['category']),
        description: _str(j['description']),
        amountLkr: _double(j['amountLkr']) ?? 0,
        cropCycleId: j['cropCycleId']?.toString(),
        fieldId: j['fieldId']?.toString(),
        paymentMethod: _str(j['paymentMethod']),
        notes: j['notes']?.toString(),
      );
}

class FarmIncome {
  FarmIncome({
    required this.id,
    required this.date,
    required this.source,
    this.cropType,
    this.quantityKg,
    this.pricePerKgLkr,
    required this.totalLkr,
    this.buyerName,
    this.cropCycleId,
    this.notes,
  });
  final String id;
  final DateTime date;
  final String source;
  final String? cropType;
  final double? quantityKg;
  final double? pricePerKgLkr;
  final double totalLkr;
  final String? buyerName;
  final String? cropCycleId;
  final String? notes;

  factory FarmIncome.fromJson(Map<String, dynamic> j) => FarmIncome(
        id: _str(j['id']),
        date: _date(j['date']) ?? DateTime.now(),
        source: _str(j['source']),
        cropType: j['cropType']?.toString(),
        quantityKg: _double(j['quantityKg']),
        pricePerKgLkr: _double(j['pricePerKgLkr']),
        totalLkr: _double(j['totalLkr']) ?? 0,
        buyerName: j['buyerName']?.toString(),
        cropCycleId: j['cropCycleId']?.toString(),
        notes: j['notes']?.toString(),
      );
}

class FarmFinanceSummary {
  FarmFinanceSummary({
    required this.totalExpense,
    required this.totalIncome,
    required this.netProfit,
    required this.expenseByCategory,
    required this.incomeBySource,
  });
  final double totalExpense;
  final double totalIncome;
  final double netProfit;
  final Map<String, double> expenseByCategory;
  final Map<String, double> incomeBySource;

  factory FarmFinanceSummary.fromJson(Map<String, dynamic> j) =>
      FarmFinanceSummary(
        totalExpense: _double(j['totalExpense']) ?? 0,
        totalIncome: _double(j['totalIncome']) ?? 0,
        netProfit: _double(j['netProfit']) ?? 0,
        expenseByCategory: _numMap(j['expenseByCategory']),
        incomeBySource: _numMap(j['incomeBySource']),
      );
}

class TraceabilityRecord {
  TraceabilityRecord({
    required this.id,
    required this.batchCode,
    required this.cropCycleId,
    this.harvestRecordId,
    required this.fieldId,
    required this.sprayLogIds,
    this.soilTestId,
    required this.harvestDate,
    this.buyerName,
    required this.certifications,
    this.qrCodeUrl,
    this.publicUrl,
  });
  final String id;
  final String batchCode;
  final String cropCycleId;
  final String? harvestRecordId;
  final String fieldId;
  final List<String> sprayLogIds;
  final String? soilTestId;
  final DateTime harvestDate;
  final String? buyerName;
  final List<String> certifications;
  final String? qrCodeUrl;
  final String? publicUrl;

  factory TraceabilityRecord.fromJson(Map<String, dynamic> j) =>
      TraceabilityRecord(
        id: _str(j['id']),
        batchCode: _str(j['batchCode']),
        cropCycleId: _str(j['cropCycleId']),
        harvestRecordId: j['harvestRecordId']?.toString(),
        fieldId: _str(j['fieldId']),
        sprayLogIds: _strList(j['sprayLogIds']),
        soilTestId: j['soilTestId']?.toString(),
        harvestDate: _date(j['harvestDate']) ?? DateTime.now(),
        buyerName: j['buyerName']?.toString(),
        certifications: _strList(j['certifications']),
        qrCodeUrl: j['qrCodeUrl']?.toString(),
        publicUrl: j['publicUrl']?.toString(),
      );
}
