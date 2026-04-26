import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/models/app_user.dart';
import '../data/models/driver.dart';
import '../data/models/fuel_log.dart';
import '../data/models/trip.dart';
import '../data/models/vehicle.dart';
import 'providers/fleet_provider.dart';

class VehicleDetailScreen extends ConsumerWidget {
  const VehicleDetailScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicleAsync = ref.watch(vehicleDetailProvider(vehicleId));
    final fuelAsync = ref.watch(vehicleFuelLogsProvider(vehicleId));
    final tripsAsync = ref.watch(vehicleTripsProvider(vehicleId));
    final analyticsAsync = ref.watch(vehicleFuelAnalyticsProvider(vehicleId));
    final user = ref.watch(currentUserProvider);

    final canEdit = user != null &&
        (user.role == UserRole.superAdmin ||
            user.role == UserRole.admin ||
            user.role == UserRole.assetManager);
    final canLogFuel = canEdit || user?.role == UserRole.driver;

    return Scaffold(
      appBar: AppBar(title: const Text('Vehicle')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: vehicleAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text('Failed to load: $e',
                  style: AppTextStyles.body.copyWith(color: AppColors.error)),
            ),
          ),
          data: (vehicle) => RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(vehicleDetailProvider(vehicleId));
              ref.invalidate(vehicleFuelLogsProvider(vehicleId));
              ref.invalidate(vehicleTripsProvider(vehicleId));
              ref.invalidate(vehicleFuelAnalyticsProvider(vehicleId));
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                _Header(vehicle: vehicle),
                const SizedBox(height: AppSpacing.md),
                _ActionsRow(
                  vehicle: vehicle,
                  canEdit: canEdit,
                  canLogFuel: canLogFuel,
                  onAssign: () => _showAssignSheet(context, ref, vehicle),
                  onLogFuel: () => _showFuelSheet(context, ref, vehicle),
                  onStartTrip: () => _showStartTripSheet(context, ref, vehicle),
                  onUpdateStatus: () => _showStatusSheet(context, ref, vehicle),
                ),
                const SizedBox(height: AppSpacing.md),
                _InfoCard(vehicle: vehicle),
                const SizedBox(height: AppSpacing.md),
                Text('Recent fuel logs', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.xs),
                fuelAsync.when(
                  loading: () => const _Skeleton(),
                  error: (e, _) => _Err('Fuel: $e'),
                  data: (logs) => _FuelList(logs: logs.take(5).toList()),
                ),
                const SizedBox(height: AppSpacing.sm),
                analyticsAsync.maybeWhen(
                  data: (a) => _AnalyticsRow(a: a),
                  orElse: () => const SizedBox.shrink(),
                ),
                const SizedBox(height: AppSpacing.md),
                Text('Recent trips', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.xs),
                tripsAsync.when(
                  loading: () => const _Skeleton(),
                  error: (e, _) => _Err('Trips: $e'),
                  data: (trips) => _TripList(trips: trips.take(5).toList()),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Action sheets ────────────────────────────────────────────────────
  Future<void> _showAssignSheet(
      BuildContext context, WidgetRef ref, Vehicle vehicle) async {
    final drivers = await _loadDrivers(context, ref);
    if (drivers == null) return;
    if (!context.mounted) return;
    String? selected;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: StatefulBuilder(builder: (ctx, setLocal) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Assign driver', style: AppTextStyles.title),
              const SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                initialValue: selected,
                decoration: const InputDecoration(labelText: 'Driver'),
                items: drivers
                    .map((d) => DropdownMenuItem(
                          value: d.id,
                          child: Text('${d.displayName} · ${d.licenseNumber}'),
                        ))
                    .toList(),
                onChanged: (v) => setLocal(() => selected = v),
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: selected == null
                    ? null
                    : () async {
                        try {
                          await ref
                              .read(fleetRemoteProvider)
                              .assignDriver(vehicle.id, selected!);
                          if (ctx.mounted) Navigator.pop(ctx);
                          ref.invalidate(vehicleDetailProvider(vehicle.id));
                        } catch (e) {
                          if (ctx.mounted) {
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(content: Text('Failed: $e')),
                            );
                          }
                        }
                      },
                child: const Text('Assign'),
              ),
            ],
          );
        }),
      ),
    );
  }

  Future<List<Driver>?> _loadDrivers(
      BuildContext context, WidgetRef ref) async {
    try {
      return await ref.read(fleetRemoteProvider).listDrivers();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not load drivers: $e')));
      }
      return null;
    }
  }

  Future<void> _showFuelSheet(
      BuildContext context, WidgetRef ref, Vehicle vehicle) async {
    final formKey = GlobalKey<FormState>();
    final liters = TextEditingController();
    final cost = TextEditingController();
    final mileage =
        TextEditingController(text: vehicle.currentMileage.toStringAsFixed(0));
    final station = TextEditingController();
    final notes = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: AppSpacing.md,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.md),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Log fuel', style: AppTextStyles.title),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: liters,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Liters'),
                validator: (v) =>
                    double.tryParse(v ?? '') == null ? 'Required' : null,
              ),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: cost,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Cost per liter'),
                validator: (v) =>
                    double.tryParse(v ?? '') == null ? 'Required' : null,
              ),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: mileage,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Odometer (km)'),
                validator: (v) =>
                    double.tryParse(v ?? '') == null ? 'Required' : null,
              ),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                  controller: station,
                  decoration: const InputDecoration(labelText: 'Station')),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                  controller: notes,
                  decoration: const InputDecoration(labelText: 'Notes')),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: () async {
                  if (!formKey.currentState!.validate()) return;
                  try {
                    await ref.read(fleetRemoteProvider).createFuelLog(
                          vehicle.id,
                          liters: double.parse(liters.text),
                          costPerLiter: double.parse(cost.text),
                          mileageAtFuel: double.parse(mileage.text),
                          fuelStation: station.text.trim().isEmpty
                              ? null
                              : station.text.trim(),
                          notes: notes.text.trim().isEmpty
                              ? null
                              : notes.text.trim(),
                        );
                    if (ctx.mounted) Navigator.pop(ctx);
                    ref.invalidate(vehicleFuelLogsProvider(vehicle.id));
                    ref.invalidate(vehicleFuelAnalyticsProvider(vehicle.id));
                    ref.invalidate(vehicleDetailProvider(vehicle.id));
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx)
                          .showSnackBar(SnackBar(content: Text('Failed: $e')));
                    }
                  }
                },
                child: const Text('Save log'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showStartTripSheet(
      BuildContext context, WidgetRef ref, Vehicle vehicle) async {
    final drivers = await _loadDrivers(context, ref);
    if (drivers == null) return;
    if (!context.mounted) return;
    final formKey = GlobalKey<FormState>();
    final start = TextEditingController();
    final end = TextEditingController();
    final mileage =
        TextEditingController(text: vehicle.currentMileage.toStringAsFixed(0));
    final purpose = TextEditingController();
    String? driverId = vehicle.driverId;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      builder: (ctx) => Padding(
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
                Text('Start trip', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<String>(
                  initialValue: driverId,
                  decoration: const InputDecoration(labelText: 'Driver'),
                  items: drivers
                      .map((d) => DropdownMenuItem(
                          value: d.id, child: Text(d.displayName)))
                      .toList(),
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Select driver' : null,
                  onChanged: (v) => setLocal(() => driverId = v),
                ),
                const SizedBox(height: AppSpacing.xs),
                TextFormField(
                    controller: start,
                    decoration:
                        const InputDecoration(labelText: 'Start location'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'Required' : null),
                const SizedBox(height: AppSpacing.xs),
                TextFormField(
                    controller: end,
                    decoration:
                        const InputDecoration(labelText: 'End location'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'Required' : null),
                const SizedBox(height: AppSpacing.xs),
                TextFormField(
                  controller: mileage,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration:
                      const InputDecoration(labelText: 'Start odometer (km)'),
                  validator: (v) =>
                      double.tryParse(v ?? '') == null ? 'Required' : null,
                ),
                const SizedBox(height: AppSpacing.xs),
                TextFormField(
                    controller: purpose,
                    decoration: const InputDecoration(labelText: 'Purpose')),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    try {
                      await ref.read(fleetRemoteProvider).startTrip(
                            vehicle.id,
                            driverId: driverId!,
                            startLocation: start.text.trim(),
                            endLocation: end.text.trim(),
                            startMileage: double.parse(mileage.text),
                            purpose: purpose.text.trim().isEmpty
                                ? null
                                : purpose.text.trim(),
                          );
                      if (ctx.mounted) Navigator.pop(ctx);
                      ref.invalidate(vehicleTripsProvider(vehicle.id));
                      ref.invalidate(vehicleDetailProvider(vehicle.id));
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(content: Text('Failed: $e')));
                      }
                    }
                  },
                  child: const Text('Start'),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }

  Future<void> _showStatusSheet(
      BuildContext context, WidgetRef ref, Vehicle vehicle) async {
    final statuses = const [
      'AVAILABLE',
      'IN_USE',
      'UNDER_MAINTENANCE',
      'OUT_OF_SERVICE',
      'DISPOSED',
    ];
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: statuses
              .map((s) => ListTile(
                    title: Text(s.replaceAll('_', ' ')),
                    trailing:
                        vehicle.status == s ? const Icon(Icons.check) : null,
                    onTap: () async {
                      Navigator.pop(ctx);
                      try {
                        await ref
                            .read(fleetRemoteProvider)
                            .updateVehicle(vehicle.id, status: s);
                        ref.invalidate(vehicleDetailProvider(vehicle.id));
                        ref.invalidate(vehicleSummaryProvider);
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Failed: $e')));
                        }
                      }
                    },
                  ))
              .toList(),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.vehicle});
  final Vehicle vehicle;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          color: AppColors.card.withOpacity(0.8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child:
                      Text(vehicle.registrationNo, style: AppTextStyles.title),
                ),
                StatusBadge(status: vehicle.status, compact: true),
              ]),
              const SizedBox(height: AppSpacing.xs),
              Text('${vehicle.make} ${vehicle.vehicleModel} · ${vehicle.year}',
                  style: AppTextStyles.bodySecondary),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionsRow extends StatelessWidget {
  const _ActionsRow({
    required this.vehicle,
    required this.canEdit,
    required this.canLogFuel,
    required this.onAssign,
    required this.onLogFuel,
    required this.onStartTrip,
    required this.onUpdateStatus,
  });
  final Vehicle vehicle;
  final bool canEdit;
  final bool canLogFuel;
  final VoidCallback onAssign;
  final VoidCallback onLogFuel;
  final VoidCallback onStartTrip;
  final VoidCallback onUpdateStatus;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        if (canEdit)
          OutlinedButton.icon(
              onPressed: onAssign,
              icon: const Icon(Icons.person_add_alt),
              label: const Text('Assign')),
        if (canLogFuel)
          OutlinedButton.icon(
              onPressed: onLogFuel,
              icon: const Icon(Icons.local_gas_station),
              label: const Text('Fuel')),
        if (canLogFuel)
          OutlinedButton.icon(
              onPressed: onStartTrip,
              icon: const Icon(Icons.play_arrow),
              label: const Text('Trip')),
        if (canEdit)
          OutlinedButton.icon(
              onPressed: onUpdateStatus,
              icon: const Icon(Icons.swap_horiz),
              label: const Text('Status')),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.vehicle});
  final Vehicle vehicle;
  @override
  Widget build(BuildContext context) {
    String fmt(DateTime? d) => d == null
        ? '—'
        : '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card.withOpacity(0.7),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _row('Driver', vehicle.driver?.displayName ?? 'Unassigned'),
          _row('Type', vehicle.type),
          _row('Fuel', vehicle.fuelType),
          _row('Mileage', '${vehicle.currentMileage.toStringAsFixed(0)} km'),
          _row('Last service', fmt(vehicle.lastServiceDate)),
          _row('Next service', fmt(vehicle.nextServiceDate)),
          _row('Insurance expiry', fmt(vehicle.insuranceExpiry)),
          _row('Road tax expiry', fmt(vehicle.roadTaxExpiry)),
          if (vehicle.vin != null) _row('VIN', vehicle.vin!),
        ],
      ),
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 130, child: Text(k, style: AppTextStyles.caption)),
          Expanded(child: Text(v, style: AppTextStyles.body)),
        ],
      ),
    );
  }
}

class _AnalyticsRow extends StatelessWidget {
  const _AnalyticsRow({required this.a});
  final FuelAnalytics a;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.warning.withOpacity(0.08),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.warning.withOpacity(0.3)),
      ),
      child: Wrap(
        spacing: AppSpacing.md,
        runSpacing: AppSpacing.xs,
        children: [
          _kv('Liters', a.totalLiters.toStringAsFixed(1)),
          _kv('Cost', a.totalCost.toStringAsFixed(2)),
          _kv('Avg \$/L', a.avgCostPerLiter.toStringAsFixed(2)),
          if (a.avgConsumption != null)
            _kv('L/100km', a.avgConsumption!.toStringAsFixed(1)),
        ],
      ),
    );
  }

  Widget _kv(String k, String v) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(k, style: AppTextStyles.caption),
          Text(v, style: AppTextStyles.body),
        ],
      );
}

class _FuelList extends StatelessWidget {
  const _FuelList({required this.logs});
  final List<FuelLog> logs;
  @override
  Widget build(BuildContext context) {
    if (logs.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.sm),
        child: Text('No fuel logs yet.', style: AppTextStyles.bodySecondary),
      );
    }
    return Column(
      children: logs.map((l) {
        return ListTile(
          leading: const Icon(Icons.local_gas_station),
          title: Text(
              '${l.liters.toStringAsFixed(1)} L · ${l.totalCost.toStringAsFixed(2)}'),
          subtitle: Text(
              '${l.fuelStation ?? '—'} · ${l.mileageAtFuel.toStringAsFixed(0)} km'),
          trailing: Text(
              '${l.date.month.toString().padLeft(2, '0')}/${l.date.day.toString().padLeft(2, '0')}',
              style: AppTextStyles.caption),
        );
      }).toList(),
    );
  }
}

class _TripList extends StatelessWidget {
  const _TripList({required this.trips});
  final List<Trip> trips;
  @override
  Widget build(BuildContext context) {
    if (trips.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.sm),
        child: Text('No trips yet.', style: AppTextStyles.bodySecondary),
      );
    }
    return Column(
      children: trips.map((t) {
        return ListTile(
          leading: Icon(
              t.isInProgress
                  ? Icons.directions_run
                  : Icons.check_circle_outline,
              color: t.isInProgress
                  ? AppColors.statusInProgress
                  : AppColors.statusCompleted),
          title: Text('${t.startLocation} → ${t.endLocation}',
              overflow: TextOverflow.ellipsis),
          subtitle: Text(
              '${t.distance.toStringAsFixed(1)} km · ${t.status.replaceAll('_', ' ')}'),
          trailing: Text(
              '${t.startTime.month.toString().padLeft(2, '0')}/${t.startTime.day.toString().padLeft(2, '0')}',
              style: AppTextStyles.caption),
        );
      }).toList(),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();
  @override
  Widget build(BuildContext context) => const Padding(
      padding: EdgeInsets.all(AppSpacing.md), child: LinearProgressIndicator());
}

class _Err extends StatelessWidget {
  const _Err(this.msg);
  final String msg;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Text(msg,
          style: AppTextStyles.body.copyWith(color: AppColors.error)));
}
