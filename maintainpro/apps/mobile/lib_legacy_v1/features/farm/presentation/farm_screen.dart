import 'package:flutter/material.dart';

import '../../../shared/models/app_user.dart';
import 'widgets/farm_list_tab.dart';

/// Top-level Farm screen for the mobile app.
///
/// Exposes the eight Nelna Farm Operations modules as tabs:
///  1. Fields              5. Spray
///  2. Crops               6. Harvest
///  3. Livestock           7. Irrigation
///  4. Animal Health       8. Attendance
class FarmScreen extends StatefulWidget {
  const FarmScreen({super.key, required this.user});

  final AppUser user;

  @override
  State<FarmScreen> createState() => _FarmScreenState();
}

class _FarmScreenState extends State<FarmScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _controller;

  static const _tabs = <Tab>[
    Tab(text: 'Fields', icon: Icon(Icons.map_outlined)),
    Tab(text: 'Crops', icon: Icon(Icons.eco_outlined)),
    Tab(text: 'Livestock', icon: Icon(Icons.pets_outlined)),
    Tab(text: 'Health', icon: Icon(Icons.medical_services_outlined)),
    Tab(text: 'Spray', icon: Icon(Icons.sanitizer_outlined)),
    Tab(text: 'Harvest', icon: Icon(Icons.agriculture_outlined)),
    Tab(text: 'Irrigation', icon: Icon(Icons.water_drop_outlined)),
    Tab(text: 'Attendance', icon: Icon(Icons.fact_check_outlined)),
  ];

  @override
  void initState() {
    super.initState();
    _controller = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            controller: _controller,
            isScrollable: true,
            tabs: _tabs,
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _controller,
            children: [
              FarmListTab(
                title: 'Fields',
                endpoint: '/farm/fields',
                rowTitle: (r) => r['name']?.toString() ?? '—',
                rowSubtitle: (r) =>
                    '${r['areaHectares'] ?? '—'} ha · ${r['soilType'] ?? '—'}',
                fields: const [
                  FarmField(name: 'name', label: 'Field name', required: true),
                  FarmField(name: 'blockCode', label: 'Block code'),
                  FarmField(
                      name: 'areaHectares',
                      label: 'Area (ha)',
                      type: FarmFieldType.number,
                      required: true),
                  FarmField(
                      name: 'soilType',
                      label: 'Soil type',
                      type: FarmFieldType.select,
                      options: [
                        'CLAY',
                        'LOAM',
                        'SANDY',
                        'SILT',
                        'PEAT',
                        'CHALKY'
                      ]),
                  FarmField(name: 'irrigationZone', label: 'Irrigation zone'),
                ],
              ),
              FarmListTab(
                title: 'Crop cycles',
                endpoint: '/farm/crops',
                rowTitle: (r) =>
                    '${r['cropType'] ?? '—'}${r['variety'] != null ? ' · ${r['variety']}' : ''}',
                rowSubtitle: (r) =>
                    'Planted ${_short(r['plantingDate'])} · ${r['status'] ?? '—'}',
                fields: const [
                  FarmField(name: 'fieldId', label: 'Field ID', required: true),
                  FarmField(
                      name: 'cropType', label: 'Crop type', required: true),
                  FarmField(name: 'variety', label: 'Variety'),
                  FarmField(
                      name: 'plantingDate',
                      label: 'Planting date',
                      type: FarmFieldType.date,
                      required: true),
                  FarmField(
                      name: 'expectedHarvestDate',
                      label: 'Expected harvest',
                      type: FarmFieldType.date),
                  FarmField(
                      name: 'status',
                      label: 'Status',
                      type: FarmFieldType.select,
                      options: [
                        'PLANNED',
                        'PLANTED',
                        'GROWING',
                        'FLOWERING',
                        'HARVEST_READY',
                        'HARVESTED',
                        'FAILED',
                        'ABANDONED'
                      ]),
                ],
              ),
              FarmListTab(
                title: 'Livestock',
                endpoint: '/farm/livestock/animals',
                rowTitle: (r) =>
                    '${r['tagNumber'] ?? '—'} · ${r['species'] ?? '—'}',
                rowSubtitle: (r) =>
                    '${r['breed'] ?? '—'} · ${r['gender'] ?? '—'} · ${r['status'] ?? '—'}',
                fields: const [
                  FarmField(
                      name: 'tagNumber', label: 'Tag number', required: true),
                  FarmField(
                      name: 'species',
                      label: 'Species',
                      type: FarmFieldType.select,
                      required: true,
                      options: [
                        'CATTLE',
                        'BUFFALO',
                        'GOAT',
                        'SHEEP',
                        'CHICKEN',
                        'DUCK',
                        'PIG',
                        'OTHER'
                      ]),
                  FarmField(name: 'breed', label: 'Breed'),
                  FarmField(
                      name: 'gender',
                      label: 'Gender',
                      type: FarmFieldType.select,
                      required: true,
                      options: ['MALE', 'FEMALE']),
                  FarmField(
                      name: 'weightKg',
                      label: 'Weight (kg)',
                      type: FarmFieldType.number),
                ],
              ),
              FarmListTab(
                title: 'Animal health records',
                endpoint: '/farm/livestock/health',
                rowTitle: (r) => '${r['type'] ?? '—'} · ${_short(r['date'])}',
                rowSubtitle: (r) =>
                    '${r['description'] ?? ''}${r['vetName'] != null ? ' · ${r['vetName']}' : ''}',
                fields: const [
                  FarmField(
                      name: 'animalId', label: 'Animal ID', required: true),
                  FarmField(
                      name: 'date',
                      label: 'Date',
                      type: FarmFieldType.date,
                      required: true),
                  FarmField(
                      name: 'type',
                      label: 'Type',
                      type: FarmFieldType.select,
                      required: true,
                      options: [
                        'VACCINATION',
                        'TREATMENT',
                        'DEWORMING',
                        'CHECKUP',
                        'INSEMINATION',
                        'SURGERY',
                        'QUARANTINE'
                      ]),
                  FarmField(
                      name: 'description',
                      label: 'Description',
                      required: true),
                  FarmField(name: 'vetName', label: 'Vet name'),
                  FarmField(name: 'medicineName', label: 'Medicine'),
                  FarmField(name: 'dosage', label: 'Dosage'),
                ],
              ),
              FarmListTab(
                title: 'Spray logs',
                endpoint: '/farm/spray-logs',
                rowTitle: (r) =>
                    '${r['chemicalName'] ?? '—'} · ${r['chemicalType'] ?? '—'}',
                rowSubtitle: (r) {
                  final phi = r['priorHarvestDays'];
                  final ok = r['complianceFlag'] == true;
                  return '${_short(r['date'])} · PHI ${phi ?? '—'}d · ${ok ? 'compliant' : 'pending'}';
                },
                fields: const [
                  FarmField(name: 'fieldId', label: 'Field ID', required: true),
                  FarmField(name: 'cropCycleId', label: 'Crop cycle ID'),
                  FarmField(
                      name: 'date',
                      label: 'Date',
                      type: FarmFieldType.date,
                      required: true),
                  FarmField(
                      name: 'chemicalName', label: 'Chemical', required: true),
                  FarmField(
                      name: 'chemicalType',
                      label: 'Type',
                      type: FarmFieldType.select,
                      required: true,
                      options: [
                        'HERBICIDE',
                        'PESTICIDE',
                        'FUNGICIDE',
                        'FERTILIZER',
                        'GROWTH_REGULATOR',
                        'ORGANIC_INPUT',
                        'OTHER'
                      ]),
                  FarmField(name: 'unit', label: 'Unit (L/kg)', required: true),
                  FarmField(
                      name: 'priorHarvestDays',
                      label: 'PHI days',
                      type: FarmFieldType.number),
                ],
              ),
              FarmListTab(
                title: 'Harvest records',
                endpoint: '/farm/harvest',
                rowTitle: (r) =>
                    '${r['quantityKg'] ?? '—'} kg · grade ${r['qualityGrade'] ?? '—'}',
                rowSubtitle: (r) =>
                    '${_short(r['harvestDate'])}${r['buyerName'] != null ? ' · ${r['buyerName']}' : ''}',
                fields: const [
                  FarmField(
                      name: 'cropCycleId',
                      label: 'Crop cycle ID',
                      required: true),
                  FarmField(
                      name: 'harvestDate',
                      label: 'Harvest date',
                      type: FarmFieldType.date,
                      required: true),
                  FarmField(
                      name: 'quantityKg',
                      label: 'Quantity (kg)',
                      type: FarmFieldType.number,
                      required: true),
                  FarmField(
                      name: 'qualityGrade',
                      label: 'Grade',
                      type: FarmFieldType.select,
                      options: ['A', 'B', 'C', 'REJECT']),
                  FarmField(
                      name: 'pricePerKgLkr',
                      label: 'Price / kg (LKR)',
                      type: FarmFieldType.number),
                  FarmField(name: 'buyerName', label: 'Buyer'),
                ],
              ),
              FarmListTab(
                title: 'Irrigation logs',
                endpoint: '/farm/irrigation',
                rowTitle: (r) =>
                    '${r['method'] ?? '—'} · ${r['waterUsedLiters'] ?? '—'} L',
                rowSubtitle: (r) =>
                    '${_short(r['startTime'])}${r['durationMinutes'] != null ? ' · ${r['durationMinutes']} min' : ''}',
                fields: const [
                  FarmField(name: 'fieldId', label: 'Field ID', required: true),
                  FarmField(
                      name: 'startTime',
                      label: 'Start time',
                      type: FarmFieldType.dateTime,
                      required: true),
                  FarmField(
                      name: 'endTime',
                      label: 'End time',
                      type: FarmFieldType.dateTime),
                  FarmField(
                      name: 'waterUsedLiters',
                      label: 'Water (L)',
                      type: FarmFieldType.number),
                  FarmField(
                      name: 'method',
                      label: 'Method',
                      type: FarmFieldType.select,
                      required: true,
                      options: [
                        'FLOOD',
                        'DRIP',
                        'SPRINKLER',
                        'FURROW',
                        'CHANNEL',
                        'MANUAL'
                      ]),
                ],
              ),
              FarmListTab(
                title: 'Attendance',
                endpoint: '/farm/workers/attendance',
                rowTitle: (r) {
                  final w = r['worker'] as Map?;
                  return '${w?['name'] ?? r['workerId'] ?? '—'} · ${r['status'] ?? '—'}';
                },
                rowSubtitle: (r) =>
                    '${_short(r['date'])} · ${r['hoursWorked'] ?? 0}h',
                fields: const [
                  FarmField(
                      name: 'workerId', label: 'Worker ID', required: true),
                  FarmField(
                      name: 'date',
                      label: 'Date',
                      type: FarmFieldType.date,
                      required: true),
                  FarmField(
                      name: 'status',
                      label: 'Status',
                      type: FarmFieldType.select,
                      required: true,
                      options: [
                        'PRESENT',
                        'ABSENT',
                        'HALF_DAY',
                        'LEAVE',
                        'HOLIDAY'
                      ]),
                  FarmField(
                      name: 'hoursWorked',
                      label: 'Hours worked',
                      type: FarmFieldType.number),
                  FarmField(name: 'taskArea', label: 'Task area'),
                  FarmField(
                      name: 'wageLkr',
                      label: 'Wage (LKR)',
                      type: FarmFieldType.number),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  static String _short(dynamic v) {
    if (v == null) return '—';
    final s = v.toString();
    if (s.length < 10) return s;
    return s.substring(0, 10);
  }
}
