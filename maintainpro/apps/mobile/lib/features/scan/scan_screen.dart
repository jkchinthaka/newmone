import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/app_strings.dart';
import '../../design_system/design_system.dart';
import '../shell/adaptive_shell.dart';

/// Universal scan UI foundation (camera wiring in a later milestone).
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _manual = TextEditingController();

  @override
  void dispose() {
    _manual.dispose();
    super.dispose();
  }

  void _onManualSubmit() {
    final code = _manual.text.trim();
    if (code.isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Scanned code: $code')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.navScan),
        actions: shellActions(context),
      ),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHighest,
                borderRadius: MpRadius.lgAll,
                border: Border.all(color: scheme.outline.withValues(alpha: 0.4)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.qr_code_scanner, size: 72, color: scheme.primary),
                  const SizedBox(height: MpSpacing.lg),
                  Text(
                    AppStrings.scanHint,
                    style: Theme.of(context).textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: MpSpacing.sm),
                  Text(
                    AppStrings.comingSoon,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: MpSpacing.xl),
          Text(
            AppStrings.scanManualHint,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: MpSpacing.sm),
          MpTextField(
            controller: _manual,
            label: 'Code',
            prefixIcon: Icons.tag,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _onManualSubmit(),
          ),
          const SizedBox(height: MpSpacing.lg),
          MpButton(
            label: 'Look up',
            icon: Icons.search,
            onPressed: _onManualSubmit,
          ),
          const SizedBox(height: MpSpacing.md),
          MpButton(
            label: 'Open work orders',
            variant: MpButtonVariant.tonal,
            onPressed: () => context.push('/work-orders'),
          ),
        ],
      ),
    );
  }
}
