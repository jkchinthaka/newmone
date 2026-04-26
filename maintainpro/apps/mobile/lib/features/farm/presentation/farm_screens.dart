import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/datasources/farm_remote_datasource.dart';
import '../data/models/farm_models.dart';
import 'providers/farm_provider.dart';

String _fmt(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
String _iso(DateTime d) => d.toUtc().toIso8601String();

Widget _glassCard({required Widget child, VoidCallback? onTap}) {
  return ClipRRect(
    borderRadius: BorderRadius.circular(AppRadius.lg),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Material(
        color: AppColors.card.withOpacity(0.7),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: child,
          ),
        ),
      ),
    ),
  );
}

Widget _statusBadge(String status, {Color? color}) {
  final c = color ?? AppColors.primaryLight;
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
    decoration: BoxDecoration(
      color: c.withOpacity(0.15),
      borderRadius: BorderRadius.circular(AppRadius.sm),
    ),
    child: Text(status, style: AppTextStyles.label.copyWith(color: c)),
  );
}

Widget _scaffold({
  required String title,
  required Widget body,
  Widget? fab,
  List<Widget>? actions,
  PreferredSizeWidget? bottom,
}) {
  return Scaffold(
    appBar: AppBar(title: Text(title), actions: actions, bottom: bottom),
    floatingActionButton: fab,
    body: Container(
      decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
      child: body,
    ),
  );
}

Widget _asyncList<T>(
  AsyncValue<List<T>> async, {
  required Widget Function(T) item,
  required VoidCallback onRefresh,
  String emptyText = 'No records yet',
}) {
  return RefreshIndicator(
    onRefresh: () async => onRefresh(),
    child: async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ListView(children: [
        const SizedBox(height: 120),
        Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Text('Failed: $e',
                style: AppTextStyles.body.copyWith(color: AppColors.error)),
          ),
        ),
      ]),
      data: (items) {
        if (items.isEmpty) {
          return ListView(children: [
            const SizedBox(height: 120),
            Center(child: Text(emptyText, style: AppTextStyles.body)),
          ]);
        }
        return ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.md),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.xs),
          itemBuilder: (_, i) => item(items[i]),
        );
      },
    ),
  );
}

Future<DateTime?> _pickDate(BuildContext ctx, {DateTime? initial}) {
  final now = DateTime.now();
  return showDatePicker(
    context: ctx,
    initialDate: initial ?? now,
    firstDate: DateTime(now.year - 5),
    lastDate: DateTime(now.year + 5),
  );
}

Future<void> _showSheet(
  BuildContext context,
  String title,
  List<Widget> Function(StateSetter setSt) build,
  Future<void> Function() onSubmit,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    builder: (ctx) {
      return StatefulBuilder(builder: (ctx, setSt) {
        return Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: AppSpacing.md,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.md,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.md),
                ...build(setSt),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () async {
                      try {
                        await onSubmit();
                        if (ctx.mounted) Navigator.of(ctx).pop();
                      } catch (e) {
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(content: Text('Failed: $e')),
                          );
                        }
                      }
                    },
                    child: const Text('Save'),
                  ),
                ),
              ],
            ),
          ),
        );
      });
    },
  );
}

// ───────────────────────────── HUB ─────────────────────────────
class FarmHubScreen extends ConsumerWidget {
  const FarmHubScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fields = ref.watch(farmFieldsProvider);
    final crops = ref.watch(farmCropsProvider);
    final animals = ref.watch(farmAnimalsProvider);
    final workers = ref.watch(farmWorkersProvider);

    Widget tile(String label, IconData icon, String path) {
      return _glassCard(
        onTap: () => context.push(path),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: AppColors.primaryLight),
            const SizedBox(height: AppSpacing.xs),
            Text(label, style: AppTextStyles.subtitle),
          ],
        ),
      );
    }

    Widget summary(String label, AsyncValue async) {
      return _glassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTextStyles.bodySecondary),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              async.when(
                loading: () => '…',
                error: (_, __) => '—',
                data: (v) => (v as List).length.toString(),
              ),
              style: AppTextStyles.title,
            ),
          ],
        ),
      );
    }

    return _scaffold(
      title: 'Farm',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          Row(children: [
            Expanded(child: summary('Fields', fields)),
            const SizedBox(width: AppSpacing.xs),
            Expanded(child: summary('Crops', crops)),
          ]),
          const SizedBox(height: AppSpacing.xs),
          Row(children: [
            Expanded(child: summary('Animals', animals)),
            const SizedBox(width: AppSpacing.xs),
            Expanded(child: summary('Workers', workers)),
          ]),
          const SizedBox(height: AppSpacing.md),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacing.xs,
            crossAxisSpacing: AppSpacing.xs,
            childAspectRatio: 2.2,
            children: [
              tile('Fields', Icons.grass, '/farm/fields'),
              tile('Crops', Icons.eco, '/farm/crops'),
              tile('Harvest', Icons.agriculture, '/farm/harvest'),
              tile('Livestock', Icons.pets, '/farm/livestock'),
              tile('Feeding', Icons.restaurant, '/farm/feeding'),
              tile('Irrigation', Icons.water_drop, '/farm/irrigation'),
              tile('Spray', Icons.science, '/farm/spray'),
              tile('Soil tests', Icons.terrain, '/farm/soil-tests'),
              tile('Weather', Icons.cloud, '/farm/weather'),
              tile('Workers', Icons.people, '/farm/workers'),
              tile('Attendance', Icons.event_available, '/farm/attendance'),
              tile('Finance', Icons.account_balance_wallet, '/farm/finance'),
              tile('Traceability', Icons.qr_code_2, '/farm/traceability'),
            ],
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────── FIELDS ─────────────────────────────
class FieldsScreen extends ConsumerWidget {
  const FieldsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmFieldsProvider);
    return _scaffold(
      title: 'Fields',
      fab: FloatingActionButton.extended(
        onPressed: () => _newField(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New field'),
      ),
      body: _asyncList<FarmField>(
        list,
        onRefresh: () => ref.invalidate(farmFieldsProvider),
        item: (f) => _glassCard(
          onTap: () => context.push('/farm/fields/${f.id}'),
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(f.name, style: AppTextStyles.subtitle),
                  Text(
                    '${f.areaHectares.toStringAsFixed(2)} ha · ${f.soilType}'
                    '${f.blockCode != null ? " · ${f.blockCode}" : ""}',
                    style: AppTextStyles.bodySecondary,
                  ),
                ],
              ),
            ),
            _statusBadge(f.status,
                color: f.status == 'ACTIVE'
                    ? AppColors.success
                    : AppColors.textSecondary),
          ]),
        ),
      ),
    );
  }
}

Future<void> _newField(BuildContext ctx, WidgetRef ref) async {
  final name = TextEditingController();
  final block = TextEditingController();
  final area = TextEditingController();
  final zone = TextEditingController();
  String soil = 'LOAM';
  await _showSheet(
      ctx,
      'New field',
      (set) => [
            TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: block,
                decoration: const InputDecoration(labelText: 'Block code')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: area,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Area (hectares)')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: soil,
              decoration: const InputDecoration(labelText: 'Soil type'),
              items: const ['LOAM', 'SAND', 'CLAY', 'SILT', 'PEAT', 'CHALK']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => soil = v ?? 'LOAM'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: zone,
                decoration:
                    const InputDecoration(labelText: 'Irrigation zone')),
          ], () async {
    await ref.read(farmRemoteProvider).createField({
      'name': name.text.trim(),
      if (block.text.isNotEmpty) 'blockCode': block.text.trim(),
      'areaHectares': double.tryParse(area.text) ?? 0,
      'soilType': soil,
      if (zone.text.isNotEmpty) 'irrigationZone': zone.text.trim(),
    });
    ref.invalidate(farmFieldsProvider);
  });
}

class FieldDetailScreen extends ConsumerWidget {
  const FieldDetailScreen({super.key, required this.fieldId});
  final String fieldId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final field = ref.watch(farmFieldProvider(fieldId));
    final crops = ref.watch(farmCropsByFieldProvider(fieldId));
    return _scaffold(
      title: 'Field',
      body: field.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed: $e')),
        data: (f) => ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            _glassCard(
                child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(f.name, style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.xs),
                Text('Area: ${f.areaHectares} ha', style: AppTextStyles.body),
                Text('Soil: ${f.soilType}', style: AppTextStyles.body),
                if (f.blockCode != null)
                  Text('Block: ${f.blockCode}', style: AppTextStyles.body),
                if (f.irrigationZone != null)
                  Text('Zone: ${f.irrigationZone}', style: AppTextStyles.body),
                const SizedBox(height: AppSpacing.xs),
                _statusBadge(f.status),
              ],
            )),
            const SizedBox(height: AppSpacing.md),
            Text('Crop cycles', style: AppTextStyles.subtitle),
            const SizedBox(height: AppSpacing.xs),
            crops.when(
              loading: () => const Padding(
                  padding: EdgeInsets.all(AppSpacing.md),
                  child: Center(child: CircularProgressIndicator())),
              error: (e, _) => Text('Failed: $e'),
              data: (list) => Column(
                children: list
                    .map((c) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                          child: _glassCard(
                            onTap: () => context.push('/farm/crops/${c.id}'),
                            child: Row(children: [
                              Expanded(
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(c.cropType,
                                          style: AppTextStyles.subtitle),
                                      Text('Planted ${_fmt(c.plantingDate)}',
                                          style: AppTextStyles.bodySecondary),
                                    ]),
                              ),
                              _statusBadge(c.status),
                            ]),
                          ),
                        ))
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────────── CROPS ─────────────────────────────
class CropsScreen extends ConsumerWidget {
  const CropsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmCropsProvider);
    return _scaffold(
      title: 'Crops',
      fab: FloatingActionButton.extended(
        onPressed: () => _newCrop(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New crop'),
      ),
      body: _asyncList<CropCycle>(
        list,
        onRefresh: () => ref.invalidate(farmCropsProvider),
        item: (c) => _glassCard(
          onTap: () => context.push('/farm/crops/${c.id}'),
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                      '${c.cropType}${c.variety != null ? " · ${c.variety}" : ""}',
                      style: AppTextStyles.subtitle),
                  Text('Planted ${_fmt(c.plantingDate)}',
                      style: AppTextStyles.bodySecondary),
                  if (c.expectedHarvestDate != null)
                    Text('Expected ${_fmt(c.expectedHarvestDate!)}',
                        style: AppTextStyles.caption),
                ],
              ),
            ),
            _statusBadge(c.status),
          ]),
        ),
      ),
    );
  }
}

Future<void> _newCrop(BuildContext ctx, WidgetRef ref) async {
  final fields = await ref.read(farmRemoteProvider).fields();
  if (fields.isEmpty) {
    if (ctx.mounted) {
      ScaffoldMessenger.of(ctx)
          .showSnackBar(const SnackBar(content: Text('Create a field first')));
    }
    return;
  }
  String fieldId = fields.first.id;
  final crop = TextEditingController();
  final variety = TextEditingController();
  final expYield = TextEditingController();
  DateTime planting = DateTime.now();
  DateTime? expHarvest;
  if (!ctx.mounted) return;
  await _showSheet(
      ctx,
      'New crop',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: fieldId,
              decoration: const InputDecoration(labelText: 'Field'),
              items: fields
                  .map(
                      (f) => DropdownMenuItem(value: f.id, child: Text(f.name)))
                  .toList(),
              onChanged: (v) => set(() => fieldId = v ?? fieldId),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: crop,
                decoration: const InputDecoration(labelText: 'Crop type')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: variety,
                decoration: const InputDecoration(labelText: 'Variety')),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Planting: ${_fmt(planting)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: planting);
                if (d != null) set(() => planting = d);
              },
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                  'Expected harvest: ${expHarvest == null ? "—" : _fmt(expHarvest!)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: expHarvest);
                if (d != null) set(() => expHarvest = d);
              },
            ),
            TextField(
                controller: expYield,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Expected yield (kg)')),
          ], () async {
    await ref.read(farmRemoteProvider).createCrop({
      'fieldId': fieldId,
      'cropType': crop.text.trim(),
      if (variety.text.isNotEmpty) 'variety': variety.text.trim(),
      'plantingDate': _iso(planting),
      if (expHarvest != null) 'expectedHarvestDate': _iso(expHarvest!),
      if (expYield.text.isNotEmpty)
        'expectedYieldKg': double.tryParse(expYield.text),
      'status': 'PLANNED',
    });
    ref.invalidate(farmCropsProvider);
  });
}

class CropDetailScreen extends ConsumerWidget {
  const CropDetailScreen({super.key, required this.cropId});
  final String cropId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final crop = ref.watch(farmCropProvider(cropId));
    return _scaffold(
      title: 'Crop',
      body: crop.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed: $e')),
        data: (c) => ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            _glassCard(
                child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    '${c.cropType}${c.variety != null ? " · ${c.variety}" : ""}',
                    style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.xs),
                _statusBadge(c.status),
                const SizedBox(height: AppSpacing.sm),
                Text('Planted ${_fmt(c.plantingDate)}',
                    style: AppTextStyles.body),
                if (c.expectedHarvestDate != null)
                  Text('Expected ${_fmt(c.expectedHarvestDate!)}',
                      style: AppTextStyles.body),
                if (c.actualHarvestDate != null)
                  Text('Harvested ${_fmt(c.actualHarvestDate!)}',
                      style: AppTextStyles.body),
                if (c.expectedYieldKg != null)
                  Text('Expected yield: ${c.expectedYieldKg} kg',
                      style: AppTextStyles.body),
                if (c.actualYieldKg != null)
                  Text('Actual yield: ${c.actualYieldKg} kg',
                      style: AppTextStyles.body),
              ],
            )),
            const SizedBox(height: AppSpacing.md),
            _glassCard(
                child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Costs (LKR)', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.xs),
                _kv('Seed', c.seedCostLkr),
                _kv('Fertilizer', c.fertilizerCostLkr),
                _kv('Pesticide', c.pesticideCostLkr),
                _kv('Labor', c.laborCostLkr),
                _kv('Irrigation', c.irrigationCostLkr),
                _kv('Other', c.otherCostLkr),
                const Divider(),
                _kv('Total', c.totalCost),
                _kv('Revenue', c.revenueLkr),
                _kv('Profit', c.profit,
                    color: c.profit >= 0 ? AppColors.success : AppColors.error),
              ],
            )),
            if (c.notes != null) ...[
              const SizedBox(height: AppSpacing.md),
              _glassCard(
                  child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Notes', style: AppTextStyles.subtitle),
                  const SizedBox(height: AppSpacing.xs),
                  Text(c.notes!, style: AppTextStyles.body),
                ],
              )),
            ],
          ],
        ),
      ),
    );
  }
}

Widget _kv(String k, double? v, {Color? color}) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(children: [
      Expanded(child: Text(k, style: AppTextStyles.bodySecondary)),
      Text(v == null ? '—' : v.toStringAsFixed(2),
          style: AppTextStyles.body
              .copyWith(color: color, fontWeight: FontWeight.w600)),
    ]),
  );
}

// ───────────────────────────── HARVEST ─────────────────────────────
class HarvestScreen extends ConsumerWidget {
  const HarvestScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmHarvestsProvider);
    return _scaffold(
      title: 'Harvest',
      fab: FloatingActionButton.extended(
        onPressed: () => _newHarvest(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Record'),
      ),
      body: _asyncList<HarvestRecord>(
        list,
        onRefresh: () => ref.invalidate(farmHarvestsProvider),
        item: (h) => _glassCard(
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${h.quantityKg} kg · ${h.qualityGrade}',
                      style: AppTextStyles.subtitle),
                  Text(_fmt(h.harvestDate), style: AppTextStyles.bodySecondary),
                  if (h.batchCode != null)
                    Text('Batch: ${h.batchCode}', style: AppTextStyles.caption),
                  if (h.totalValueLkr != null)
                    Text('Value: LKR ${h.totalValueLkr!.toStringAsFixed(2)}',
                        style: AppTextStyles.caption),
                ],
              ),
            ),
            if (h.buyerName != null) _statusBadge(h.buyerName!),
          ]),
        ),
      ),
    );
  }
}

Future<void> _newHarvest(BuildContext ctx, WidgetRef ref) async {
  final crops = await ref.read(farmRemoteProvider).crops();
  if (crops.isEmpty) {
    if (ctx.mounted) {
      ScaffoldMessenger.of(ctx).showSnackBar(
          const SnackBar(content: Text('Create a crop cycle first')));
    }
    return;
  }
  String cropId = crops.first.id;
  String grade = 'A';
  final qty = TextEditingController();
  final price = TextEditingController();
  final buyer = TextEditingController();
  final batch = TextEditingController();
  DateTime date = DateTime.now();
  if (!ctx.mounted) return;
  await _showSheet(
      ctx,
      'New harvest',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: cropId,
              decoration: const InputDecoration(labelText: 'Crop cycle'),
              items: crops
                  .map((c) => DropdownMenuItem(
                      value: c.id,
                      child: Text(
                          '${c.cropType}${c.variety != null ? " · ${c.variety}" : ""}')))
                  .toList(),
              onChanged: (v) => set(() => cropId = v ?? cropId),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            TextField(
                controller: qty,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Quantity (kg)')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: grade,
              decoration: const InputDecoration(labelText: 'Grade'),
              items: const ['A', 'B', 'C']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => grade = v ?? grade),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: price,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Price per kg (LKR)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: buyer,
                decoration: const InputDecoration(labelText: 'Buyer')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: batch,
                decoration: const InputDecoration(labelText: 'Batch code')),
          ], () async {
    final qtyVal = double.tryParse(qty.text) ?? 0;
    final priceVal = double.tryParse(price.text);
    await ref.read(farmRemoteProvider).createHarvest({
      'cropCycleId': cropId,
      'harvestDate': _iso(date),
      'quantityKg': qtyVal,
      'qualityGrade': grade,
      if (priceVal != null) 'pricePerKgLkr': priceVal,
      if (priceVal != null) 'totalValueLkr': priceVal * qtyVal,
      if (buyer.text.isNotEmpty) 'buyerName': buyer.text.trim(),
      if (batch.text.isNotEmpty) 'batchCode': batch.text.trim(),
    });
    ref.invalidate(farmHarvestsProvider);
  });
}

// ───────────────────────────── LIVESTOCK ─────────────────────────────
class LivestockScreen extends ConsumerWidget {
  const LivestockScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmAnimalsProvider);
    return _scaffold(
      title: 'Livestock',
      fab: FloatingActionButton.extended(
        onPressed: () => _newAnimal(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New animal'),
      ),
      body: _asyncList<LivestockAnimal>(
        list,
        onRefresh: () => ref.invalidate(farmAnimalsProvider),
        item: (a) => _glassCard(
          onTap: () => context.push('/farm/livestock/${a.id}'),
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('#${a.tagNumber} · ${a.species}',
                      style: AppTextStyles.subtitle),
                  Text(
                      '${a.gender}${a.breed != null ? " · ${a.breed}" : ""}'
                      '${a.weightKg != null ? " · ${a.weightKg} kg" : ""}',
                      style: AppTextStyles.bodySecondary),
                ],
              ),
            ),
            _statusBadge(a.status),
          ]),
        ),
      ),
    );
  }
}

Future<void> _newAnimal(BuildContext ctx, WidgetRef ref) async {
  final tag = TextEditingController();
  final breed = TextEditingController();
  final weight = TextEditingController();
  String species = 'CATTLE';
  String gender = 'FEMALE';
  await _showSheet(
      ctx,
      'New animal',
      (set) => [
            TextField(
                controller: tag,
                decoration: const InputDecoration(labelText: 'Tag number')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: species,
              decoration: const InputDecoration(labelText: 'Species'),
              items: const [
                'CATTLE',
                'GOAT',
                'SHEEP',
                'POULTRY',
                'PIG',
                'OTHER'
              ].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (v) => set(() => species = v ?? species),
            ),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: gender,
              decoration: const InputDecoration(labelText: 'Gender'),
              items: const ['MALE', 'FEMALE']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => gender = v ?? gender),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: breed,
                decoration: const InputDecoration(labelText: 'Breed')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: weight,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Weight (kg)')),
          ], () async {
    await ref.read(farmRemoteProvider).createAnimal({
      'tagNumber': tag.text.trim(),
      'species': species,
      'gender': gender,
      if (breed.text.isNotEmpty) 'breed': breed.text.trim(),
      if (weight.text.isNotEmpty) 'weightKg': double.tryParse(weight.text),
    });
    ref.invalidate(farmAnimalsProvider);
  });
}

class AnimalDetailScreen extends ConsumerStatefulWidget {
  const AnimalDetailScreen({super.key, required this.animalId});
  final String animalId;
  @override
  ConsumerState<AnimalDetailScreen> createState() => _AnimalDetailScreenState();
}

class _AnimalDetailScreenState extends ConsumerState<AnimalDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 2, vsync: this);
  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final animal = ref.watch(farmAnimalProvider(widget.animalId));
    final health = ref.watch(farmAnimalHealthProvider(widget.animalId));
    final prod = ref.watch(farmAnimalProductionProvider(widget.animalId));
    return _scaffold(
      title: 'Animal',
      bottom: TabBar(
        controller: _tab,
        tabs: const [Tab(text: 'Health'), Tab(text: 'Production')],
      ),
      fab: FloatingActionButton.extended(
        onPressed: () {
          if (_tab.index == 0) {
            _newHealth(context, ref, widget.animalId);
          } else {
            _newProduction(context, ref, widget.animalId);
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: animal.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed: $e')),
        data: (a) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: _glassCard(
                  child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('#${a.tagNumber} · ${a.species}',
                      style: AppTextStyles.title),
                  Text('${a.gender}${a.breed != null ? " · ${a.breed}" : ""}',
                      style: AppTextStyles.bodySecondary),
                  const SizedBox(height: AppSpacing.xs),
                  _statusBadge(a.status),
                ],
              )),
            ),
            Expanded(
              child: TabBarView(controller: _tab, children: [
                _asyncList<AnimalHealthRecord>(
                  health,
                  onRefresh: () =>
                      ref.invalidate(farmAnimalHealthProvider(widget.animalId)),
                  emptyText: 'No health records',
                  item: (h) => _glassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${h.type} · ${_fmt(h.date)}',
                            style: AppTextStyles.subtitle),
                        Text(h.description, style: AppTextStyles.body),
                        if (h.medicineName != null)
                          Text('Med: ${h.medicineName} ${h.dosage ?? ""}',
                              style: AppTextStyles.caption),
                        if (h.costLkr != null)
                          Text('Cost: LKR ${h.costLkr}',
                              style: AppTextStyles.caption),
                      ],
                    ),
                  ),
                ),
                _asyncList<AnimalProductionLog>(
                  prod,
                  onRefresh: () => ref.invalidate(
                      farmAnimalProductionProvider(widget.animalId)),
                  emptyText: 'No production logs',
                  item: (p) => _glassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${p.type} · ${_fmt(p.date)}',
                            style: AppTextStyles.subtitle),
                        Text(
                          [
                            if (p.quantityLiters != null)
                              '${p.quantityLiters} L',
                            if (p.quantityCount != null)
                              '${p.quantityCount} units',
                            if (p.quantityKg != null) '${p.quantityKg} kg',
                            if (p.qualityGrade != null)
                              'Grade ${p.qualityGrade}',
                          ].join(' · '),
                          style: AppTextStyles.body,
                        ),
                      ],
                    ),
                  ),
                ),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _newHealth(
    BuildContext ctx, WidgetRef ref, String animalId) async {
  final desc = TextEditingController();
  final med = TextEditingController();
  final dose = TextEditingController();
  final cost = TextEditingController();
  final vet = TextEditingController();
  String type = 'VACCINATION';
  DateTime date = DateTime.now();
  await _showSheet(
      ctx,
      'Health record',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Type'),
              items: const [
                'VACCINATION',
                'TREATMENT',
                'CHECKUP',
                'DEWORMING',
                'OTHER'
              ].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (v) => set(() => type = v ?? type),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            TextField(
                controller: desc,
                decoration: const InputDecoration(labelText: 'Description')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: vet,
                decoration: const InputDecoration(labelText: 'Vet name')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: med,
                decoration: const InputDecoration(labelText: 'Medicine')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: dose,
                decoration: const InputDecoration(labelText: 'Dosage')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: cost,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Cost (LKR)')),
          ], () async {
    await ref.read(farmRemoteProvider).createAnimalHealth(animalId, {
      'date': _iso(date),
      'type': type,
      'description': desc.text.trim(),
      if (vet.text.isNotEmpty) 'vetName': vet.text.trim(),
      if (med.text.isNotEmpty) 'medicineName': med.text.trim(),
      if (dose.text.isNotEmpty) 'dosage': dose.text.trim(),
      if (cost.text.isNotEmpty) 'costLkr': double.tryParse(cost.text),
    });
    ref.invalidate(farmAnimalHealthProvider(animalId));
  });
}

Future<void> _newProduction(
    BuildContext ctx, WidgetRef ref, String animalId) async {
  final litres = TextEditingController();
  final count = TextEditingController();
  final kg = TextEditingController();
  String type = 'MILK';
  String? grade;
  DateTime date = DateTime.now();
  await _showSheet(
      ctx,
      'Production log',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Type'),
              items: const ['MILK', 'EGGS', 'MEAT', 'WOOL', 'OTHER']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => type = v ?? type),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            TextField(
                controller: litres,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Litres')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: count,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Count')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: kg,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Kg')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: grade,
              decoration: const InputDecoration(labelText: 'Grade'),
              items: const [null, 'A', 'B', 'C']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e ?? '—')))
                  .toList(),
              onChanged: (v) => set(() => grade = v),
            ),
          ], () async {
    await ref.read(farmRemoteProvider).createAnimalProduction(animalId, {
      'date': _iso(date),
      'type': type,
      if (litres.text.isNotEmpty)
        'quantityLiters': double.tryParse(litres.text),
      if (count.text.isNotEmpty) 'quantityCount': int.tryParse(count.text),
      if (kg.text.isNotEmpty) 'quantityKg': double.tryParse(kg.text),
      if (grade != null) 'qualityGrade': grade,
    });
    ref.invalidate(farmAnimalProductionProvider(animalId));
  });
}

// ───────────────────────────── FEEDING ─────────────────────────────
class FeedingScreen extends ConsumerWidget {
  const FeedingScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmFeedingsProvider);
    return _scaffold(
      title: 'Feeding',
      fab: FloatingActionButton.extended(
        onPressed: () => _newFeeding(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Log feeding'),
      ),
      body: _asyncList<FeedingLog>(
        list,
        onRefresh: () => ref.invalidate(farmFeedingsProvider),
        item: (f) => _glassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${f.feedType} · ${f.quantityKg} kg',
                  style: AppTextStyles.subtitle),
              Text(_fmt(f.date), style: AppTextStyles.bodySecondary),
              if (f.groupLabel != null)
                Text('Group: ${f.groupLabel}', style: AppTextStyles.caption),
              if (f.costLkr != null)
                Text('Cost: LKR ${f.costLkr}', style: AppTextStyles.caption),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _newFeeding(BuildContext ctx, WidgetRef ref) async {
  final feed = TextEditingController();
  final qty = TextEditingController();
  final cost = TextEditingController();
  final group = TextEditingController();
  DateTime date = DateTime.now();
  await _showSheet(
      ctx,
      'Feeding log',
      (set) => [
            TextField(
                controller: feed,
                decoration: const InputDecoration(labelText: 'Feed type')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: qty,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Quantity (kg)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: group,
                decoration:
                    const InputDecoration(labelText: 'Group label (optional)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: cost,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Cost (LKR)')),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
          ], () async {
    await ref.read(farmRemoteProvider).createFeeding({
      'feedType': feed.text.trim(),
      'quantityKg': double.tryParse(qty.text) ?? 0,
      if (group.text.isNotEmpty) 'groupLabel': group.text.trim(),
      if (cost.text.isNotEmpty) 'costLkr': double.tryParse(cost.text),
      'date': _iso(date),
    });
    ref.invalidate(farmFeedingsProvider);
  });
}

// ───────────────────────────── IRRIGATION ─────────────────────────────
class IrrigationScreen extends ConsumerWidget {
  const IrrigationScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmIrrigationsProvider);
    return _scaffold(
      title: 'Irrigation',
      fab: FloatingActionButton.extended(
        onPressed: () => _newIrrigation(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Log'),
      ),
      body: _asyncList<IrrigationLog>(
        list,
        onRefresh: () => ref.invalidate(farmIrrigationsProvider),
        item: (i) => _glassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${i.method} · ${_fmt(i.startTime)}',
                  style: AppTextStyles.subtitle),
              if (i.durationMinutes != null)
                Text('${i.durationMinutes} min',
                    style: AppTextStyles.bodySecondary),
              if (i.waterUsedLiters != null)
                Text('${i.waterUsedLiters} L', style: AppTextStyles.caption),
              if (i.costLkr != null)
                Text('Cost: LKR ${i.costLkr}', style: AppTextStyles.caption),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _newIrrigation(BuildContext ctx, WidgetRef ref) async {
  final fields = await ref.read(farmRemoteProvider).fields();
  if (fields.isEmpty) {
    if (ctx.mounted) {
      ScaffoldMessenger.of(ctx)
          .showSnackBar(const SnackBar(content: Text('Create a field first')));
    }
    return;
  }
  String fieldId = fields.first.id;
  String method = 'DRIP';
  final dur = TextEditingController();
  final water = TextEditingController();
  final cost = TextEditingController();
  DateTime start = DateTime.now();
  if (!ctx.mounted) return;
  await _showSheet(
      ctx,
      'Irrigation log',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: fieldId,
              decoration: const InputDecoration(labelText: 'Field'),
              items: fields
                  .map(
                      (f) => DropdownMenuItem(value: f.id, child: Text(f.name)))
                  .toList(),
              onChanged: (v) => set(() => fieldId = v ?? fieldId),
            ),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: method,
              decoration: const InputDecoration(labelText: 'Method'),
              items: const ['DRIP', 'SPRINKLER', 'FLOOD', 'MANUAL', 'OTHER']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => method = v ?? method),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Start: ${_fmt(start)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: start);
                if (d != null) set(() => start = d);
              },
            ),
            TextField(
                controller: dur,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Duration (minutes)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: water,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Water used (litres)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: cost,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Cost (LKR)')),
          ], () async {
    await ref.read(farmRemoteProvider).createIrrigation({
      'fieldId': fieldId,
      'startTime': _iso(start),
      'method': method,
      if (dur.text.isNotEmpty) 'durationMinutes': int.tryParse(dur.text),
      if (water.text.isNotEmpty) 'waterUsedLiters': double.tryParse(water.text),
      if (cost.text.isNotEmpty) 'costLkr': double.tryParse(cost.text),
    });
    ref.invalidate(farmIrrigationsProvider);
  });
}

// ───────────────────────────── SPRAY ─────────────────────────────
class SprayLogsScreen extends ConsumerStatefulWidget {
  const SprayLogsScreen({super.key});
  @override
  ConsumerState<SprayLogsScreen> createState() => _SprayLogsScreenState();
}

class _SprayLogsScreenState extends ConsumerState<SprayLogsScreen> {
  bool _complianceOnly = false;
  @override
  Widget build(BuildContext context) {
    final list = ref.watch(farmSprayLogsProvider);
    return _scaffold(
      title: 'Spray logs',
      fab: FloatingActionButton.extended(
        onPressed: () => _newSpray(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Log'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(children: [
              FilterChip(
                label: const Text('Compliance only'),
                selected: _complianceOnly,
                onSelected: (v) => setState(() => _complianceOnly = v),
              ),
            ]),
          ),
          Expanded(
            child: _asyncList<SprayLog>(
              list.whenData((items) => _complianceOnly
                  ? items.where((s) => s.complianceFlag).toList()
                  : items),
              onRefresh: () => ref.invalidate(farmSprayLogsProvider),
              item: (s) => _glassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(
                        child: Text('${s.chemicalName} · ${s.chemicalType}',
                            style: AppTextStyles.subtitle),
                      ),
                      _statusBadge(
                        s.complianceFlag ? 'OK' : 'CHECK',
                        color: s.complianceFlag
                            ? AppColors.success
                            : AppColors.warning,
                      ),
                    ]),
                    Text(_fmt(s.date), style: AppTextStyles.bodySecondary),
                    if (s.targetPestDisease != null)
                      Text('Target: ${s.targetPestDisease}',
                          style: AppTextStyles.caption),
                    if (s.totalQuantityUsed != null)
                      Text('Used: ${s.totalQuantityUsed} ${s.unit}',
                          style: AppTextStyles.caption),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _newSpray(BuildContext ctx, WidgetRef ref) async {
  final fields = await ref.read(farmRemoteProvider).fields();
  if (fields.isEmpty) {
    if (ctx.mounted) {
      ScaffoldMessenger.of(ctx)
          .showSnackBar(const SnackBar(content: Text('Create a field first')));
    }
    return;
  }
  String fieldId = fields.first.id;
  String chemType = 'PESTICIDE';
  String unit = 'L';
  final name = TextEditingController();
  final target = TextEditingController();
  final qty = TextEditingController();
  final dose = TextEditingController();
  final cost = TextEditingController();
  final reEntry = TextEditingController();
  final priorHarvest = TextEditingController();
  DateTime date = DateTime.now();
  if (!ctx.mounted) return;
  await _showSheet(
      ctx,
      'Spray log',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: fieldId,
              decoration: const InputDecoration(labelText: 'Field'),
              items: fields
                  .map(
                      (f) => DropdownMenuItem(value: f.id, child: Text(f.name)))
                  .toList(),
              onChanged: (v) => set(() => fieldId = v ?? fieldId),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Chemical name')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: chemType,
              decoration: const InputDecoration(labelText: 'Chemical type'),
              items: const ['PESTICIDE', 'HERBICIDE', 'FUNGICIDE', 'FERTILIZER']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => chemType = v ?? chemType),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: target,
                decoration:
                    const InputDecoration(labelText: 'Target pest/disease')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: dose,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Dosage per hectare')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: qty,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Total quantity used')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: unit,
              decoration: const InputDecoration(labelText: 'Unit'),
              items: const ['L', 'ML', 'KG', 'G']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => unit = v ?? unit),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: cost,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Cost (LKR)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: reEntry,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Re-entry interval (hrs)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: priorHarvest,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Prior to harvest (days)')),
          ], () async {
    await ref.read(farmRemoteProvider).createSpray({
      'fieldId': fieldId,
      'date': _iso(date),
      'chemicalName': name.text.trim(),
      'chemicalType': chemType,
      if (target.text.isNotEmpty) 'targetPestDisease': target.text.trim(),
      if (dose.text.isNotEmpty) 'dosagePerHectare': double.tryParse(dose.text),
      if (qty.text.isNotEmpty) 'totalQuantityUsed': double.tryParse(qty.text),
      'unit': unit,
      if (cost.text.isNotEmpty) 'costLkr': double.tryParse(cost.text),
      if (reEntry.text.isNotEmpty)
        'reEntryIntervalHrs': int.tryParse(reEntry.text),
      if (priorHarvest.text.isNotEmpty)
        'priorHarvestDays': int.tryParse(priorHarvest.text),
    });
    ref.invalidate(farmSprayLogsProvider);
  });
}

// ───────────────────────────── SOIL TESTS ─────────────────────────────
class SoilTestsScreen extends ConsumerWidget {
  const SoilTestsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmSoilTestsProvider);
    return _scaffold(
      title: 'Soil tests',
      fab: FloatingActionButton.extended(
        onPressed: () => _newSoilTest(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New test'),
      ),
      body: _asyncList<SoilTest>(
        list,
        onRefresh: () => ref.invalidate(farmSoilTestsProvider),
        item: (s) => _glassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_fmt(s.testDate), style: AppTextStyles.subtitle),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.xxs,
                children: [
                  if (s.ph != null) Text('pH ${s.ph}'),
                  if (s.nitrogenPpm != null) Text('N ${s.nitrogenPpm} ppm'),
                  if (s.phosphorusPpm != null) Text('P ${s.phosphorusPpm} ppm'),
                  if (s.potassiumPpm != null) Text('K ${s.potassiumPpm} ppm'),
                  if (s.organicMatterPct != null)
                    Text('OM ${s.organicMatterPct}%'),
                ],
              ),
              if (s.recommendation != null)
                Text(s.recommendation!, style: AppTextStyles.caption),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _newSoilTest(BuildContext ctx, WidgetRef ref) async {
  final fields = await ref.read(farmRemoteProvider).fields();
  if (fields.isEmpty) {
    if (ctx.mounted) {
      ScaffoldMessenger.of(ctx)
          .showSnackBar(const SnackBar(content: Text('Create a field first')));
    }
    return;
  }
  String fieldId = fields.first.id;
  final ph = TextEditingController();
  final n = TextEditingController();
  final p = TextEditingController();
  final k = TextEditingController();
  final om = TextEditingController();
  final rec = TextEditingController();
  final lab = TextEditingController();
  DateTime date = DateTime.now();
  if (!ctx.mounted) return;
  await _showSheet(
      ctx,
      'Soil test',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: fieldId,
              decoration: const InputDecoration(labelText: 'Field'),
              items: fields
                  .map(
                      (f) => DropdownMenuItem(value: f.id, child: Text(f.name)))
                  .toList(),
              onChanged: (v) => set(() => fieldId = v ?? fieldId),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Test date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            TextField(
                controller: ph,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'pH')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: n,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Nitrogen (ppm)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: p,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Phosphorus (ppm)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: k,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Potassium (ppm)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: om,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Organic matter %')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: rec,
                decoration: const InputDecoration(labelText: 'Recommendation')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: lab,
                decoration: const InputDecoration(labelText: 'Lab name')),
          ], () async {
    await ref.read(farmRemoteProvider).createSoilTest({
      'fieldId': fieldId,
      'testDate': _iso(date),
      if (ph.text.isNotEmpty) 'ph': double.tryParse(ph.text),
      if (n.text.isNotEmpty) 'nitrogenPpm': double.tryParse(n.text),
      if (p.text.isNotEmpty) 'phosphorusPpm': double.tryParse(p.text),
      if (k.text.isNotEmpty) 'potassiumPpm': double.tryParse(k.text),
      if (om.text.isNotEmpty) 'organicMatterPct': double.tryParse(om.text),
      if (rec.text.isNotEmpty) 'recommendation': rec.text.trim(),
      if (lab.text.isNotEmpty) 'labName': lab.text.trim(),
    });
    ref.invalidate(farmSoilTestsProvider);
  });
}

// ───────────────────────────── WEATHER ─────────────────────────────
class WeatherScreen extends ConsumerStatefulWidget {
  const WeatherScreen({super.key});
  @override
  ConsumerState<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends ConsumerState<WeatherScreen> {
  bool _alertsOnly = false;
  @override
  Widget build(BuildContext context) {
    final list = _alertsOnly
        ? ref.watch(farmWeatherAlertsProvider)
        : ref.watch(farmWeatherLogsProvider);
    return _scaffold(
      title: 'Weather',
      fab: FloatingActionButton.extended(
        onPressed: () => _newWeather(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Log'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(children: [
              FilterChip(
                label: const Text('Alerts only'),
                selected: _alertsOnly,
                onSelected: (v) => setState(() => _alertsOnly = v),
              ),
            ]),
          ),
          Expanded(
            child: _asyncList<WeatherLog>(
              list,
              onRefresh: () {
                ref.invalidate(farmWeatherLogsProvider);
                ref.invalidate(farmWeatherAlertsProvider);
              },
              item: (w) => _glassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(
                        child: Text(
                          '${w.condition ?? "—"} · ${_fmt(w.recordedAt)}',
                          style: AppTextStyles.subtitle,
                        ),
                      ),
                      if (w.alertTriggered)
                        _statusBadge('ALERT', color: AppColors.error),
                    ]),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xxs,
                      children: [
                        if (w.temperatureC != null) Text('${w.temperatureC}°C'),
                        if (w.rainfallMm != null)
                          Text('Rain ${w.rainfallMm}mm'),
                        if (w.humidityPct != null)
                          Text('Hum ${w.humidityPct}%'),
                        if (w.windSpeedKmh != null)
                          Text('Wind ${w.windSpeedKmh}km/h'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _newWeather(BuildContext ctx, WidgetRef ref) async {
  final temp = TextEditingController();
  final rain = TextEditingController();
  final hum = TextEditingController();
  final wind = TextEditingController();
  final cond = TextEditingController();
  DateTime date = DateTime.now();
  await _showSheet(
      ctx,
      'Weather log',
      (set) => [
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Recorded: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            TextField(
                controller: temp,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Temperature °C')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: rain,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Rainfall mm')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: hum,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Humidity %')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: wind,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Wind km/h')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: cond,
                decoration: const InputDecoration(labelText: 'Condition')),
          ], () async {
    await ref.read(farmRemoteProvider).createWeather({
      'recordedAt': _iso(date),
      if (temp.text.isNotEmpty) 'temperatureC': double.tryParse(temp.text),
      if (rain.text.isNotEmpty) 'rainfallMm': double.tryParse(rain.text),
      if (hum.text.isNotEmpty) 'humidityPct': double.tryParse(hum.text),
      if (wind.text.isNotEmpty) 'windSpeedKmh': double.tryParse(wind.text),
      if (cond.text.isNotEmpty) 'condition': cond.text.trim(),
      'source': 'MANUAL',
    });
    ref.invalidate(farmWeatherLogsProvider);
    ref.invalidate(farmWeatherAlertsProvider);
  });
}

// ───────────────────────────── WORKERS ─────────────────────────────
class WorkersScreen extends ConsumerWidget {
  const WorkersScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmWorkersProvider);
    return _scaffold(
      title: 'Workers',
      fab: FloatingActionButton.extended(
        onPressed: () => _newWorker(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New worker'),
      ),
      body: _asyncList<FarmWorker>(
        list,
        onRefresh: () => ref.invalidate(farmWorkersProvider),
        item: (w) => _glassCard(
          onTap: () => context.push('/farm/workers/${w.id}'),
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(w.name, style: AppTextStyles.subtitle),
                  Text(
                      '${w.workerType}${w.phone != null ? " · ${w.phone}" : ""}',
                      style: AppTextStyles.bodySecondary),
                  if (w.dailyWageLkr != null)
                    Text('LKR ${w.dailyWageLkr}/day',
                        style: AppTextStyles.caption),
                ],
              ),
            ),
            _statusBadge(w.status,
                color: w.status == 'ACTIVE'
                    ? AppColors.success
                    : AppColors.textSecondary),
          ]),
        ),
      ),
    );
  }
}

Future<void> _newWorker(BuildContext ctx, WidgetRef ref) async {
  final name = TextEditingController();
  final nic = TextEditingController();
  final phone = TextEditingController();
  final addr = TextEditingController();
  final wage = TextEditingController();
  String type = 'PERMANENT';
  await _showSheet(
      ctx,
      'New worker',
      (set) => [
            TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Type'),
              items: const ['PERMANENT', 'CASUAL', 'CONTRACT']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => type = v ?? type),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: nic,
                decoration: const InputDecoration(labelText: 'NIC')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: phone,
                decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: addr,
                decoration: const InputDecoration(labelText: 'Address')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: wage,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Daily wage (LKR)')),
          ], () async {
    await ref.read(farmRemoteProvider).createWorker({
      'name': name.text.trim(),
      'workerType': type,
      if (nic.text.isNotEmpty) 'nic': nic.text.trim(),
      if (phone.text.isNotEmpty) 'phone': phone.text.trim(),
      if (addr.text.isNotEmpty) 'address': addr.text.trim(),
      if (wage.text.isNotEmpty) 'dailyWageLkr': double.tryParse(wage.text),
    });
    ref.invalidate(farmWorkersProvider);
  });
}

class WorkerDetailScreen extends ConsumerWidget {
  const WorkerDetailScreen({super.key, required this.workerId});
  final String workerId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final worker = ref.watch(farmWorkerProvider(workerId));
    final att = ref.watch(farmWorkerAttendanceProvider(workerId));
    return _scaffold(
      title: 'Worker',
      fab: FloatingActionButton.extended(
        onPressed: () => _recordAttendance(context, ref, workerId),
        icon: const Icon(Icons.add),
        label: const Text('Attendance'),
      ),
      body: worker.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed: $e')),
        data: (w) => ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            _glassCard(
                child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(w.name, style: AppTextStyles.title),
                Text(w.workerType, style: AppTextStyles.bodySecondary),
                if (w.phone != null)
                  Text('Phone: ${w.phone}', style: AppTextStyles.body),
                if (w.dailyWageLkr != null)
                  Text('Wage: LKR ${w.dailyWageLkr}/day',
                      style: AppTextStyles.body),
                const SizedBox(height: AppSpacing.xs),
                _statusBadge(w.status),
              ],
            )),
            const SizedBox(height: AppSpacing.md),
            Text('Attendance', style: AppTextStyles.subtitle),
            const SizedBox(height: AppSpacing.xs),
            att.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Text('Failed: $e'),
              data: (list) => Column(
                children: list
                    .map((a) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                          child: _glassCard(
                            child: Row(children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(_fmt(a.date),
                                        style: AppTextStyles.body),
                                    if (a.hoursWorked != null)
                                      Text('${a.hoursWorked} hrs',
                                          style: AppTextStyles.caption),
                                    if (a.taskArea != null)
                                      Text(a.taskArea!,
                                          style: AppTextStyles.caption),
                                  ],
                                ),
                              ),
                              _statusBadge(
                                a.status,
                                color: a.status == 'PRESENT'
                                    ? AppColors.success
                                    : AppColors.warning,
                              ),
                            ]),
                          ),
                        ))
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _recordAttendance(
    BuildContext ctx, WidgetRef ref, String workerId) async {
  String status = 'PRESENT';
  final hours = TextEditingController();
  final task = TextEditingController();
  final wage = TextEditingController();
  DateTime date = DateTime.now();
  await _showSheet(
      ctx,
      'Attendance',
      (set) => [
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            DropdownButtonFormField<String>(
              initialValue: status,
              decoration: const InputDecoration(labelText: 'Status'),
              items: const ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => status = v ?? status),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: hours,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Hours worked')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: task,
                decoration: const InputDecoration(labelText: 'Task / area')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: wage,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Wage (LKR)')),
          ], () async {
    await ref.read(farmRemoteProvider).recordAttendance({
      'workerId': workerId,
      'date': _iso(date),
      'status': status,
      if (hours.text.isNotEmpty) 'hoursWorked': double.tryParse(hours.text),
      if (task.text.isNotEmpty) 'taskArea': task.text.trim(),
      if (wage.text.isNotEmpty) 'wageLkr': double.tryParse(wage.text),
    });
    ref.invalidate(farmWorkerAttendanceProvider(workerId));
  });
}

class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // tenantId is required by backend; AppUser has none. Show informational empty state via per-worker view link.
    return _scaffold(
      title: 'Attendance',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          _glassCard(
              child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Tenant attendance view', style: AppTextStyles.subtitle),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Open a worker to view and record their attendance.',
                style: AppTextStyles.bodySecondary,
              ),
              const SizedBox(height: AppSpacing.sm),
              FilledButton.icon(
                onPressed: () => context.push('/farm/workers'),
                icon: const Icon(Icons.people),
                label: const Text('Open workers'),
              ),
            ],
          )),
        ],
      ),
    );
  }
}

// ───────────────────────────── FINANCE ─────────────────────────────
class FinanceScreen extends ConsumerStatefulWidget {
  const FinanceScreen({super.key});
  @override
  ConsumerState<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends ConsumerState<FinanceScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 3, vsync: this);
  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final summary = ref.watch(farmFinanceSummaryProvider);
    final expenses = ref.watch(farmExpensesProvider);
    final incomes = ref.watch(farmIncomesProvider);
    return _scaffold(
      title: 'Finance',
      bottom: TabBar(controller: _tab, tabs: const [
        Tab(text: 'Summary'),
        Tab(text: 'Expenses'),
        Tab(text: 'Income'),
      ]),
      fab: _tab.index == 0
          ? null
          : FloatingActionButton.extended(
              onPressed: () {
                if (_tab.index == 1) {
                  _newExpense(context, ref);
                } else {
                  _newIncome(context, ref);
                }
              },
              icon: const Icon(Icons.add),
              label: const Text('Add'),
            ),
      body: TabBarView(controller: _tab, children: [
        summary.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Failed: $e')),
          data: (s) => RefreshIndicator(
            onRefresh: () async => ref.invalidate(farmFinanceSummaryProvider),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                _glassCard(
                    child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Totals', style: AppTextStyles.subtitle),
                    const SizedBox(height: AppSpacing.xs),
                    _kv('Income', s.totalIncome, color: AppColors.success),
                    _kv('Expense', s.totalExpense, color: AppColors.error),
                    _kv('Net profit', s.netProfit,
                        color: s.netProfit >= 0
                            ? AppColors.success
                            : AppColors.error),
                  ],
                )),
                const SizedBox(height: AppSpacing.md),
                if (s.expenseByCategory.isNotEmpty)
                  _glassCard(
                      child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Expense by category',
                          style: AppTextStyles.subtitle),
                      const SizedBox(height: AppSpacing.xs),
                      ...s.expenseByCategory.entries
                          .map((e) => _kv(e.key, e.value)),
                    ],
                  )),
                const SizedBox(height: AppSpacing.md),
                if (s.incomeBySource.isNotEmpty)
                  _glassCard(
                      child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Income by source', style: AppTextStyles.subtitle),
                      const SizedBox(height: AppSpacing.xs),
                      ...s.incomeBySource.entries
                          .map((e) => _kv(e.key, e.value)),
                    ],
                  )),
              ],
            ),
          ),
        ),
        _asyncList<FarmExpense>(
          expenses,
          onRefresh: () => ref.invalidate(farmExpensesProvider),
          item: (e) => _glassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${e.category} · LKR ${e.amountLkr.toStringAsFixed(2)}',
                    style: AppTextStyles.subtitle),
                Text(_fmt(e.date), style: AppTextStyles.bodySecondary),
                Text(e.description, style: AppTextStyles.body),
              ],
            ),
          ),
        ),
        _asyncList<FarmIncome>(
          incomes,
          onRefresh: () => ref.invalidate(farmIncomesProvider),
          item: (i) => _glassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${i.source} · LKR ${i.totalLkr.toStringAsFixed(2)}',
                    style: AppTextStyles.subtitle),
                Text(_fmt(i.date), style: AppTextStyles.bodySecondary),
                if (i.cropType != null)
                  Text(i.cropType!, style: AppTextStyles.caption),
                if (i.buyerName != null)
                  Text('Buyer: ${i.buyerName}', style: AppTextStyles.caption),
              ],
            ),
          ),
        ),
      ]),
    );
  }
}

Future<void> _newExpense(BuildContext ctx, WidgetRef ref) async {
  final desc = TextEditingController();
  final amt = TextEditingController();
  String category = 'SEED';
  String pay = 'CASH';
  DateTime date = DateTime.now();
  await _showSheet(
      ctx,
      'New expense',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: category,
              decoration: const InputDecoration(labelText: 'Category'),
              items: const [
                'SEED',
                'FERTILIZER',
                'PESTICIDE',
                'LABOR',
                'IRRIGATION',
                'EQUIPMENT',
                'FEED',
                'VET',
                'OTHER'
              ].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (v) => set(() => category = v ?? category),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            TextField(
                controller: desc,
                decoration: const InputDecoration(labelText: 'Description')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: amt,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount (LKR)')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: pay,
              decoration: const InputDecoration(labelText: 'Payment method'),
              items: const ['CASH', 'BANK', 'CREDIT', 'OTHER']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => set(() => pay = v ?? pay),
            ),
          ], () async {
    await ref.read(farmRemoteProvider).createExpense({
      'date': _iso(date),
      'category': category,
      'description': desc.text.trim(),
      'amountLkr': double.tryParse(amt.text) ?? 0,
      'paymentMethod': pay,
    });
    ref.invalidate(farmExpensesProvider);
    ref.invalidate(farmFinanceSummaryProvider);
  });
}

Future<void> _newIncome(BuildContext ctx, WidgetRef ref) async {
  final crop = TextEditingController();
  final qty = TextEditingController();
  final price = TextEditingController();
  final total = TextEditingController();
  final buyer = TextEditingController();
  String source = 'CROP_SALE';
  DateTime date = DateTime.now();
  await _showSheet(
      ctx,
      'New income',
      (set) => [
            DropdownButtonFormField<String>(
              initialValue: source,
              decoration: const InputDecoration(labelText: 'Source'),
              items: const [
                'CROP_SALE',
                'LIVESTOCK_SALE',
                'MILK',
                'EGGS',
                'OTHER'
              ].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (v) => set(() => source = v ?? source),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Date: ${_fmt(date)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await _pickDate(ctx, initial: date);
                if (d != null) set(() => date = d);
              },
            ),
            TextField(
                controller: crop,
                decoration: const InputDecoration(labelText: 'Crop type')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: qty,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Quantity (kg)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: price,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Price per kg (LKR)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: total,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Total (LKR)')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
                controller: buyer,
                decoration: const InputDecoration(labelText: 'Buyer')),
          ], () async {
    await ref.read(farmRemoteProvider).createIncome({
      'date': _iso(date),
      'source': source,
      if (crop.text.isNotEmpty) 'cropType': crop.text.trim(),
      if (qty.text.isNotEmpty) 'quantityKg': double.tryParse(qty.text),
      if (price.text.isNotEmpty) 'pricePerKgLkr': double.tryParse(price.text),
      'totalLkr': double.tryParse(total.text) ?? 0,
      if (buyer.text.isNotEmpty) 'buyerName': buyer.text.trim(),
    });
    ref.invalidate(farmIncomesProvider);
    ref.invalidate(farmFinanceSummaryProvider);
  });
}

// ───────────────────────────── TRACEABILITY ─────────────────────────────
class TraceabilityScreen extends ConsumerWidget {
  const TraceabilityScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(farmTraceabilityProvider);
    return _scaffold(
      title: 'Traceability',
      body: _asyncList<TraceabilityRecord>(
        list,
        onRefresh: () => ref.invalidate(farmTraceabilityProvider),
        item: (t) => _glassCard(
          child: Row(children: [
            const Icon(Icons.qr_code_2,
                size: 48, color: AppColors.primaryLight),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.batchCode, style: AppTextStyles.subtitle),
                  Text('Harvested ${_fmt(t.harvestDate)}',
                      style: AppTextStyles.bodySecondary),
                  if (t.buyerName != null)
                    Text('Buyer: ${t.buyerName}', style: AppTextStyles.caption),
                  if (t.certifications.isNotEmpty)
                    Wrap(
                      spacing: AppSpacing.xxs,
                      children:
                          t.certifications.map((c) => _statusBadge(c)).toList(),
                    ),
                ],
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
