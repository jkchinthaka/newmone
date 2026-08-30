import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/supplier.dart';
import 'providers/suppliers_provider.dart';

class SupplierDetailScreen extends ConsumerWidget {
  const SupplierDetailScreen({super.key, required this.supplierId});
  final String supplierId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(supplierProvider(supplierId));
    return Scaffold(
      appBar: AppBar(title: const Text('Supplier')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(supplierProvider(supplierId)),
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
                child: Text('Failed: $e',
                    style:
                        AppTextStyles.body.copyWith(color: AppColors.error))),
            data: (s) => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                _Card(s: s),
                const SizedBox(height: AppSpacing.md),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: Icon(s.isActive
                          ? Icons.pause_circle_outline
                          : Icons.play_circle_outline),
                      label: Text(s.isActive ? 'Deactivate' : 'Activate'),
                      onPressed: () async {
                        try {
                          await ref
                              .read(suppliersRemoteProvider)
                              .update(s.id, isActive: !s.isActive);
                          ref.invalidate(supplierProvider(supplierId));
                          ref.invalidate(suppliersProvider);
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Failed: $e')),
                            );
                          }
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: FilledButton.icon(
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Edit'),
                      onPressed: () => _showEdit(context, ref, s),
                    ),
                  ),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.s});
  final Supplier s;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          color: AppColors.card.withValues(alpha: 0.7),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(s.name, style: AppTextStyles.title),
              const Divider(height: AppSpacing.lg),
              if (s.contactName != null)
                _Row(label: 'Contact', value: s.contactName!),
              if (s.email != null) _Row(label: 'Email', value: s.email!),
              if (s.phone != null) _Row(label: 'Phone', value: s.phone!),
              if (s.address != null) _Row(label: 'Address', value: s.address!),
              if (s.website != null) _Row(label: 'Website', value: s.website!),
              if (s.taxNumber != null)
                _Row(label: 'Tax #', value: s.taxNumber!),
              if (s.notes != null) _Row(label: 'Notes', value: s.notes!),
              _Row(label: 'Status', value: s.isActive ? 'Active' : 'Inactive'),
            ],
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
            flex: 2, child: Text(label, style: AppTextStyles.bodySecondary)),
        Expanded(flex: 3, child: Text(value, style: AppTextStyles.body)),
      ]),
    );
  }
}

Future<void> _showEdit(BuildContext context, WidgetRef ref, Supplier s) async {
  final nameCtrl = TextEditingController(text: s.name);
  final contactCtrl = TextEditingController(text: s.contactName ?? '');
  final emailCtrl = TextEditingController(text: s.email ?? '');
  final phoneCtrl = TextEditingController(text: s.phone ?? '');
  final addressCtrl = TextEditingController(text: s.address ?? '');
  final websiteCtrl = TextEditingController(text: s.website ?? '');
  final taxCtrl = TextEditingController(text: s.taxNumber ?? '');
  final notesCtrl = TextEditingController(text: s.notes ?? '');

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    builder: (ctx) {
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
              const Text('Edit supplier', style: AppTextStyles.title),
              const SizedBox(height: AppSpacing.md),
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name')),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                  controller: contactCtrl,
                  decoration: const InputDecoration(labelText: 'Contact name')),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                  controller: emailCtrl,
                  decoration: const InputDecoration(labelText: 'Email')),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                  controller: phoneCtrl,
                  decoration: const InputDecoration(labelText: 'Phone')),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                  controller: addressCtrl,
                  decoration: const InputDecoration(labelText: 'Address')),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                  controller: websiteCtrl,
                  decoration: const InputDecoration(labelText: 'Website')),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                  controller: taxCtrl,
                  decoration: const InputDecoration(labelText: 'Tax #')),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                  controller: notesCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Notes')),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: () async {
                  String? n(TextEditingController c) =>
                      c.text.trim().isEmpty ? null : c.text.trim();
                  try {
                    await ref.read(suppliersRemoteProvider).update(
                          s.id,
                          name: nameCtrl.text.trim(),
                          contactName: n(contactCtrl),
                          email: n(emailCtrl),
                          phone: n(phoneCtrl),
                          address: n(addressCtrl),
                          website: n(websiteCtrl),
                          taxNumber: n(taxCtrl),
                          notes: n(notesCtrl),
                        );
                    if (ctx.mounted) Navigator.of(ctx).pop();
                    ref.invalidate(supplierProvider(s.id));
                    ref.invalidate(suppliersProvider);
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
            ],
          ),
        ),
      );
    },
  );
}
