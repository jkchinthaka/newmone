import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/offline/offline_sync.dart';
import '../data/models/driver.dart';
import '../data/models/fuel_log.dart';
import '../data/models/vehicle.dart';
import 'providers/fleet_provider.dart';

class FuelLogsScreen extends ConsumerWidget {
  const FuelLogsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(allFuelLogsProvider);
    final analytics = ref.watch(fleetFuelAnalyticsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Fuel logs')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Log fuel'),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(allFuelLogsProvider);
            ref.invalidate(fleetFuelAnalyticsProvider);
          },
          child: logs.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Text('Failed: $e',
                    style: AppTextStyles.body.copyWith(color: AppColors.error)),
              ),
            ),
            data: (list) {
              if (list.isEmpty) {
                return ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: [
                    _FuelAnalyticsSummary(async: analytics),
                    const SizedBox(height: 120),
                    const Center(child: Text('No fuel logs yet.')),
                  ],
                );
              }
              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  _FuelAnalyticsSummary(async: analytics),
                  const SizedBox(height: AppSpacing.md),
                  ...list.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                        child: _FuelTile(log: item),
                      )),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _showCreateSheet(BuildContext context, WidgetRef ref) async {
    List<Vehicle> vehicles;
    List<Driver> drivers;
    try {
      final res =
          await ref.read(fleetRemoteProvider).listVehicles(pageSize: 200);
      vehicles = res.items;
      drivers = await ref.read(fleetRemoteProvider).listDrivers();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not load fleet data: $e')));
      }
      return;
    }
    if (!context.mounted || vehicles.isEmpty) return;

    final formKey = GlobalKey<FormState>();
    String? vehicleId;
    String selectedDriverId = '';
    final liters = TextEditingController();
    final cost = TextEditingController();
    final mileage = TextEditingController();
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
          bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.md,
        ),
        child: StatefulBuilder(builder: (ctx, setLocal) {
          return Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Log fuel', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<String>(
                  initialValue: vehicleId,
                  decoration: const InputDecoration(labelText: 'Vehicle'),
                  items: vehicles
                      .map((v) => DropdownMenuItem(
                          value: v.id,
                          child: Text(v.displayLabel,
                              overflow: TextOverflow.ellipsis)))
                      .toList(),
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Required' : null,
                  onChanged: (v) => setLocal(() {
                    vehicleId = v;
                    final sel = vehicles.firstWhere((e) => e.id == v);
                    if (mileage.text.isEmpty) {
                      mileage.text = sel.currentMileage.toStringAsFixed(0);
                    }
                  }),
                ),
                const SizedBox(height: AppSpacing.xs),
                DropdownButtonFormField<String>(
                  initialValue: selectedDriverId,
                  decoration:
                      const InputDecoration(labelText: 'Driver attribution'),
                  items: [
                    const DropdownMenuItem<String>(
                      value: '',
                      child: Text('Use current vehicle assignment'),
                    ),
                    ...drivers.map(
                      (driver) => DropdownMenuItem<String>(
                        value: driver.id,
                        child: Text(
                          driver.displayName,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                  onChanged: (value) =>
                      setLocal(() => selectedDriverId = value ?? ''),
                ),
                const SizedBox(height: AppSpacing.xs),
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
                  decoration:
                      const InputDecoration(labelText: 'Cost per liter'),
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
                    final messenger = ScaffoldMessenger.of(context);
                    try {
                      final result = await ref
                          .read(offlineSyncControllerProvider)
                          .submitFuelLog(
                            vehicleId!,
                          driverId: selectedDriverId.isEmpty
                                ? null
                                : selectedDriverId,
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
                      if (result.isSynced) {
                        ref.invalidate(allFuelLogsProvider);
                        ref.invalidate(fleetFuelAnalyticsProvider);
                        if (context.mounted) {
                          messenger.showSnackBar(
                            const SnackBar(content: Text('Fuel log saved')),
                          );
                        }
                      } else if (context.mounted) {
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(
                              result.isDuplicate
                                  ? 'This fuel log is already queued for sync.'
                                  : 'Saved offline. This fuel log will sync when you are back online.',
                            ),
                          ),
                        );
                      }
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(content: Text('Failed: $e')));
                      }
                    }
                  },
                  child: const Text('Save'),
                )
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _FuelAnalyticsSummary extends StatelessWidget {
  const _FuelAnalyticsSummary({required this.async});

  final AsyncValue<FuelAnalytics> async;

  @override
  Widget build(BuildContext context) {
    return async.when(
      loading: () => Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.card.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
        ),
        child: const Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (analytics) => Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.card.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Fuel analytics', style: AppTextStyles.title),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                _SummaryChip(
                  label: 'Total liters',
                  value: analytics.totalLiters.toStringAsFixed(1),
                  color: AppColors.info,
                ),
                _SummaryChip(
                  label: 'Total cost',
                  value: analytics.totalCost.toStringAsFixed(2),
                  color: AppColors.warning,
                ),
                _SummaryChip(
                  label: 'Avg cost / L',
                  value: analytics.avgCostPerLiter.toStringAsFixed(2),
                  color: AppColors.success,
                ),
                _SummaryChip(
                  label: 'Fuel flags',
                  value: analytics.abnormalUsageCount.toString(),
                  color: analytics.abnormalUsageCount > 0
                      ? AppColors.error
                      : AppColors.success,
                ),
              ],
            ),
            if (analytics.anomalies.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                'Recent anomaly flags',
                style:
                    AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.xs),
              ...analytics.anomalies.take(3).map(
                    (item) => Padding(
                      padding:
                          const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
                      child: Text(
                        '${item.registrationNo ?? item.vehicleId ?? 'Vehicle'} · ${item.litersPer100Km.toStringAsFixed(1)} L/100km · ${item.distance.toStringAsFixed(0)} km',
                        style: AppTextStyles.bodySecondary,
                      ),
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: AppTextStyles.caption),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            value,
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _FuelTile extends StatelessWidget {
  const _FuelTile({required this.log});
  final FuelLog log;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          color: AppColors.card.withValues(alpha: 0.7),
          child: ListTile(
            leading:
                const Icon(Icons.local_gas_station, color: AppColors.warning),
            title: Text(
                '${log.vehicleRegistrationNo ?? log.vehicleId} · ${log.liters.toStringAsFixed(1)} L'),
            subtitle: Text(
                '${log.totalCost.toStringAsFixed(2)} · ${log.fuelStation ?? '—'}'),
            trailing: Text(
                '${log.date.year}-${log.date.month.toString().padLeft(2, '0')}-${log.date.day.toString().padLeft(2, '0')}',
                style: AppTextStyles.caption),
          ),
        ),
      ),
    );
  }
}
