import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/billing_provider.dart';

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

Widget _scaffold({
  required String title,
  required Widget body,
  List<Widget>? actions,
}) {
  return Scaffold(
    extendBodyBehindAppBar: true,
    appBar: AppBar(
      title: Text(title),
      backgroundColor: Colors.transparent,
      elevation: 0,
      actions: actions,
    ),
    body: Container(
      decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
      child: SafeArea(child: body),
    ),
  );
}

String _fmtValue(dynamic v) {
  if (v == null) return '—';
  if (v is num) {
    if (v == v.roundToDouble()) return v.toStringAsFixed(0);
    return v.toStringAsFixed(2);
  }
  if (v is bool) return v ? 'Yes' : 'No';
  return v.toString();
}

String _humanKey(String k) {
  final spaced =
      k.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}');
  return spaced.isEmpty ? k : spaced[0].toUpperCase() + spaced.substring(1);
}

Widget _kv(String k, dynamic v, {Color? color}) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
    child: Row(
      children: [
        Expanded(
            flex: 4,
            child: Text(_humanKey(k), style: AppTextStyles.bodySecondary)),
        Expanded(
          flex: 5,
          child: Text(
            _fmtValue(v),
            style: AppTextStyles.body.copyWith(color: color),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    ),
  );
}

class BillingHubScreen extends ConsumerWidget {
  const BillingHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subAsync = ref.watch(billingSubscriptionProvider);
    final usageAsync = ref.watch(billingUsageProvider);

    return _scaffold(
      title: 'Billing',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: () {
            ref.invalidate(billingSubscriptionProvider);
            ref.invalidate(billingUsageProvider);
          },
        ),
      ],
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(billingSubscriptionProvider);
          ref.invalidate(billingUsageProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(AppSpacing.md,
              kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
          children: [
            Text('Subscription', style: AppTextStyles.title),
            const SizedBox(height: AppSpacing.sm),
            subAsync.when(
              data: (data) => _glassCard(
                child: data.isEmpty
                    ? Text('No active subscription',
                        style: AppTextStyles.bodySecondary)
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final e in data.entries)
                            if (e.value is! Map && e.value is! List)
                              _kv(e.key, e.value),
                        ],
                      ),
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _glassCard(
                child: Text('Failed to load: $e', style: AppTextStyles.body),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('Usage', style: AppTextStyles.title),
            const SizedBox(height: AppSpacing.sm),
            usageAsync.when(
              data: (data) => _glassCard(
                child: data.isEmpty
                    ? Text('No usage data', style: AppTextStyles.bodySecondary)
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final e in data.entries)
                            if (e.value is! Map && e.value is! List)
                              _kv(e.key, e.value),
                          for (final e in data.entries)
                            if (e.value is Map<String, dynamic>) ...[
                              const SizedBox(height: AppSpacing.sm),
                              Text(_humanKey(e.key),
                                  style: AppTextStyles.subtitle),
                              const SizedBox(height: AppSpacing.xs),
                              for (final inner
                                  in (e.value as Map<String, dynamic>).entries)
                                _kv(inner.key, inner.value),
                            ],
                        ],
                      ),
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _glassCard(
                child: Text('Failed to load: $e', style: AppTextStyles.body),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: () => _checkout(context, ref),
              icon: const Icon(Icons.payment),
              label: const Text('Upgrade / Manage'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _checkout(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController(text: 'pro');
    final priceCtrl = TextEditingController();
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom,
              left: AppSpacing.md,
              right: AppSpacing.md,
              top: AppSpacing.md),
          child: _glassCard(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Start checkout', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: controller,
                  decoration: const InputDecoration(labelText: 'Plan code'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: priceCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Price ID (optional)'),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => Navigator.pop(ctx, {
                          'plan': controller.text.trim(),
                          if (priceCtrl.text.trim().isNotEmpty)
                            'priceId': priceCtrl.text.trim(),
                        }),
                        child: const Text('Continue'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
    if (result == null) return;
    try {
      final session =
          await ref.read(billingRemoteProvider).createCheckoutSession(result);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(
                'Session: ${session['id'] ?? session['url'] ?? 'created'}')),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }
}
