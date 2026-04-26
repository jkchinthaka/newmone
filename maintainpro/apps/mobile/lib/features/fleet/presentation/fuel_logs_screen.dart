import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/fuel_log.dart';
import '../data/models/vehicle.dart';
import 'providers/fleet_provider.dart';

class FuelLogsScreen extends ConsumerWidget {
  const FuelLogsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(allFuelLogsProvider);

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
          onRefresh: () async => ref.invalidate(allFuelLogsProvider),
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
                  children: const [
                    SizedBox(height: 120),
                    Center(child: Text('No fuel logs yet.')),
                  ],
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.xs),
                itemBuilder: (_, i) => _FuelTile(log: list[i]),
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _showCreateSheet(BuildContext context, WidgetRef ref) async {
    List<Vehicle> vehicles;
    try {
      final res =
          await ref.read(fleetRemoteProvider).listVehicles(pageSize: 200);
      vehicles = res.items;
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not load vehicles: $e')));
      }
      return;
    }
    if (!context.mounted || vehicles.isEmpty) return;

    final formKey = GlobalKey<FormState>();
    String? vehicleId;
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
                Text('Log fuel', style: AppTextStyles.title),
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
                    try {
                      await ref.read(fleetRemoteProvider).createFuelLog(
                            vehicleId!,
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
                      ref.invalidate(allFuelLogsProvider);
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
