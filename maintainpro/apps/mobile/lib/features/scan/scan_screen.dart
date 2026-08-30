import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/app_strings.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import '../gate/data/gate_api_client.dart';
import '../gate/data/gate_models.dart';
import '../shell/adaptive_shell.dart';

/// Universal scan UI foundation (camera wiring in a later milestone).
class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  final _manual = TextEditingController();
  bool _resolving = false;

  @override
  void dispose() {
    _manual.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _onManualSubmit() async {
    final code = _manual.text.trim();
    if (code.isEmpty) return;

    if (looksLikeVehicleId(code)) {
      context.push('/gate/vehicle/$code');
      return;
    }

    // Registration / opaque tag — try gate vehicle search then open.
    if (_isOffline) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Scanned code: $code')),
      );
      return;
    }

    setState(() => _resolving = true);
    try {
      final matches =
          await ref.read(gateApiClientProvider).searchVehicles(code);
      if (!mounted) return;
      if (matches.length == 1) {
        context.push('/gate/vehicle/${matches.first.id}');
      } else if (matches.isNotEmpty) {
        context.push('/gate');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Found ${matches.length} vehicles for "$code" — search on Gate',
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No vehicle match for: $code')),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Scanned code: $code')),
      );
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
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
                border:
                    Border.all(color: scheme.outline.withValues(alpha: 0.4)),
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
            isLoading: _resolving,
            onPressed: _resolving ? null : _onManualSubmit,
          ),
          const SizedBox(height: MpSpacing.md),
          MpButton(
            label: 'Open Gate',
            variant: MpButtonVariant.tonal,
            icon: Icons.local_shipping_outlined,
            onPressed: () => context.push('/gate'),
          ),
          const SizedBox(height: MpSpacing.md),
          MpButton(
            label: 'Open work orders',
            variant: MpButtonVariant.outlined,
            onPressed: () => context.push('/work-orders'),
          ),
        ],
      ),
    );
  }
}
