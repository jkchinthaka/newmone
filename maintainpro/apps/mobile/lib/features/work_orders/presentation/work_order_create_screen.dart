import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import 'providers/work_orders_provider.dart';

const _priorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const _typeOptions = [
  'PREVENTIVE',
  'CORRECTIVE',
  'EMERGENCY',
  'INSPECTION',
  'INSTALLATION',
];

class WorkOrderCreateScreen extends ConsumerStatefulWidget {
  const WorkOrderCreateScreen({super.key});

  @override
  ConsumerState<WorkOrderCreateScreen> createState() =>
      _WorkOrderCreateScreenState();
}

class _WorkOrderCreateScreenState extends ConsumerState<WorkOrderCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _assetCtrl = TextEditingController();
  final _vehicleCtrl = TextEditingController();

  String _priority = 'MEDIUM';
  String _type = 'CORRECTIVE';
  DateTime? _dueDate;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _assetCtrl.dispose();
    _vehicleCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? now.add(const Duration(days: 1)),
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365 * 2)),
    );
    if (picked != null) {
      setState(() => _dueDate = picked);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final user = ref.read(currentUserProvider);
    if (user == null) {
      setState(() => _error = 'You must be signed in.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    HapticFeedback.mediumImpact();

    try {
      final wo = await ref.read(workOrdersRemoteProvider).create(
            title: _titleCtrl.text.trim(),
            description: _descCtrl.text.trim(),
            priority: _priority,
            type: _type,
            createdById: user.id,
            assetId:
                _assetCtrl.text.trim().isEmpty ? null : _assetCtrl.text.trim(),
            vehicleId: _vehicleCtrl.text.trim().isEmpty
                ? null
                : _vehicleCtrl.text.trim(),
            dueDate: _dueDate,
          );

      if (!mounted) return;
      await ref.read(workOrdersListProvider.notifier).refresh();
      if (!mounted) return;
      context.go('/work-orders/${wo.id}');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('New Work Order'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                TextFormField(
                  controller: _titleCtrl,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Title *',
                    prefixIcon: Icon(Icons.title_rounded),
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _descCtrl,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Description *',
                    alignLabelWithHint: true,
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: AppSpacing.md),
                Text('Priority', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    for (final p in _priorityOptions)
                      ChoiceChip(
                        label: Text(p),
                        selected: _priority == p,
                        onSelected: (_) => setState(() => _priority = p),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text('Type', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    for (final t in _typeOptions)
                      ChoiceChip(
                        label: Text(t),
                        selected: _type == t,
                        onSelected: (_) => setState(() => _type = t),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _assetCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Asset ID (optional)',
                    prefixIcon: Icon(Icons.precision_manufacturing_outlined),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _vehicleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Vehicle ID (optional)',
                    prefixIcon: Icon(Icons.directions_car_outlined),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                InkWell(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  onTap: _pickDate,
                  child: InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'Due date (optional)',
                      prefixIcon: Icon(Icons.event_outlined),
                    ),
                    child: Text(
                      _dueDate == null
                          ? 'Pick a date'
                          : DateFormatter.shortDate(_dueDate),
                      style: AppTextStyles.body,
                    ),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.error.withOpacity(0.12),
                      border: Border.all(color: AppColors.error),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline,
                            color: AppColors.error, size: 18),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: Text(_error!,
                              style: AppTextStyles.body.copyWith(
                                color: AppColors.error,
                              )),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                FilledButton.icon(
                  onPressed: _saving ? null : _submit,
                  icon: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_rounded),
                  label: Text(_saving ? 'Creating…' : 'Create work order'),
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
