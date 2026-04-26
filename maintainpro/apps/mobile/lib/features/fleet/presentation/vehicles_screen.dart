import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/models/app_user.dart';
import '../data/models/vehicle.dart';
import 'providers/fleet_provider.dart';

class VehiclesScreen extends ConsumerStatefulWidget {
  const VehiclesScreen({super.key});

  @override
  ConsumerState<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends ConsumerState<VehiclesScreen> {
  Timer? _debounce;
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      final filters = ref.read(vehicleListFiltersProvider);
      ref.read(vehicleListFiltersProvider.notifier).state =
          filters.copyWith(q: value.isEmpty ? null : value, page: 1);
    });
  }

  void _toggleStatus(String status) {
    final f = ref.read(vehicleListFiltersProvider);
    final next = List<String>.from(f.statuses);
    if (next.contains(status)) {
      next.remove(status);
    } else {
      next.add(status);
    }
    ref.read(vehicleListFiltersProvider.notifier).state =
        f.copyWith(statuses: next, page: 1);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(vehiclesProvider);
    final filters = ref.watch(vehicleListFiltersProvider);
    final user = ref.watch(currentUserProvider);
    final canCreate = user != null &&
        (user.role == UserRole.superAdmin ||
            user.role == UserRole.admin ||
            user.role == UserRole.assetManager);

    final statusOptions = const [
      'AVAILABLE',
      'IN_USE',
      'UNDER_MAINTENANCE',
      'OUT_OF_SERVICE',
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Vehicles')),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => _showCreateSheet(context),
              icon: const Icon(Icons.add),
              label: const Text('Vehicle'),
            )
          : null,
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: _onSearchChanged,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Search registration or make…',
                  ),
                ),
              ),
              SizedBox(
                height: 56,
                child: ListView(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                  scrollDirection: Axis.horizontal,
                  children: statusOptions.map((s) {
                    final selected = filters.statuses.contains(s);
                    return Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.xs),
                      child: FilterChip(
                        label: Text(s.replaceAll('_', ' ')),
                        selected: selected,
                        onSelected: (_) => _toggleStatus(s),
                      ),
                    );
                  }).toList(),
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () =>
                      ref.read(vehiclesProvider.notifier).refresh(),
                  child: _buildList(state),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildList(VehicleListState state) {
    if (state.loading && state.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Text('Could not load vehicles\n${state.error}',
              textAlign: TextAlign.center,
              style: AppTextStyles.body.copyWith(color: AppColors.error)),
        ),
      );
    }
    if (state.items.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Text('No vehicles match your filters.',
                  style: AppTextStyles.bodySecondary),
            ),
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.md),
      itemCount: state.items.length,
      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (_, i) => _VehicleCard(vehicle: state.items[i]),
    );
  }

  Future<void> _showCreateSheet(BuildContext context) async {
    final formKey = GlobalKey<FormState>();
    final reg = TextEditingController();
    final make = TextEditingController();
    final model = TextEditingController();
    final year = TextEditingController(text: DateTime.now().year.toString());
    String type = 'CAR';
    String fuel = 'PETROL';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(AppRadius.lg))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
              left: AppSpacing.md,
              right: AppSpacing.md,
              top: AppSpacing.md,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.md),
          child: StatefulBuilder(builder: (ctx, setLocal) {
            return Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Add vehicle', style: AppTextStyles.title),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: reg,
                    decoration:
                        const InputDecoration(labelText: 'Registration'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: make,
                    decoration: const InputDecoration(labelText: 'Make'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: model,
                    decoration: const InputDecoration(labelText: 'Model'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: year,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Year'),
                    validator: (v) {
                      final n = int.tryParse(v ?? '');
                      if (n == null || n < 1900 || n > 2100) {
                        return 'Enter a valid year';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  DropdownButtonFormField<String>(
                    initialValue: type,
                    decoration: const InputDecoration(labelText: 'Type'),
                    items: const [
                      'CAR',
                      'MOTORCYCLE',
                      'TRUCK',
                      'VAN',
                      'BUS',
                      'HEAVY_EQUIPMENT',
                      'OTHER'
                    ]
                        .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                        .toList(),
                    onChanged: (v) => setLocal(() => type = v ?? 'CAR'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  DropdownButtonFormField<String>(
                    initialValue: fuel,
                    decoration: const InputDecoration(labelText: 'Fuel type'),
                    items: const [
                      'PETROL',
                      'DIESEL',
                      'ELECTRIC',
                      'HYBRID',
                      'CNG',
                      'LPG'
                    ]
                        .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                        .toList(),
                    onChanged: (v) => setLocal(() => fuel = v ?? 'PETROL'),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  FilledButton(
                    onPressed: () async {
                      if (!formKey.currentState!.validate()) return;
                      try {
                        await ref.read(fleetRemoteProvider).createVehicle(
                              registrationNo: reg.text.trim(),
                              make: make.text.trim(),
                              vehicleModel: model.text.trim(),
                              year: int.parse(year.text),
                              type: type,
                              fuelType: fuel,
                            );
                        if (ctx.mounted) Navigator.pop(ctx);
                        await ref.read(vehiclesProvider.notifier).refresh();
                        ref.invalidate(vehicleSummaryProvider);
                      } catch (e) {
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(content: Text('Failed: $e')));
                        }
                      }
                    },
                    child: const Text('Create'),
                  ),
                ],
              ),
            );
          }),
        );
      },
    );
  }
}

class _VehicleCard extends StatelessWidget {
  const _VehicleCard({required this.vehicle});
  final Vehicle vehicle;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withOpacity(0.7),
          child: InkWell(
            onTap: () => context.push('/fleet/vehicles/${vehicle.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(vehicle.displayLabel,
                          style: AppTextStyles.subtitle,
                          overflow: TextOverflow.ellipsis),
                    ),
                    StatusBadge(status: vehicle.status, compact: true),
                  ]),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${vehicle.year} · ${vehicle.type} · ${vehicle.fuelType}',
                    style: AppTextStyles.bodySecondary,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(children: [
                    const Icon(Icons.speed,
                        size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text('${vehicle.currentMileage.toStringAsFixed(0)} km',
                        style: AppTextStyles.caption),
                    const SizedBox(width: AppSpacing.md),
                    if (vehicle.driver != null) ...[
                      const Icon(Icons.person,
                          size: 16, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(vehicle.driver!.displayName,
                            style: AppTextStyles.caption,
                            overflow: TextOverflow.ellipsis),
                      ),
                    ] else
                      const Text('Unassigned', style: AppTextStyles.caption),
                  ]),
                  if (vehicle.serviceOverdue || vehicle.serviceDueSoon) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Row(children: [
                      Icon(Icons.warning_amber_rounded,
                          size: 16,
                          color: vehicle.serviceOverdue
                              ? AppColors.error
                              : AppColors.warning),
                      const SizedBox(width: 4),
                      Text(
                        vehicle.serviceOverdue
                            ? 'Service overdue'
                            : 'Service due soon',
                        style: AppTextStyles.caption.copyWith(
                          color: vehicle.serviceOverdue
                              ? AppColors.error
                              : AppColors.warning,
                        ),
                      ),
                    ]),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
