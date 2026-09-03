import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/app_strings.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/gate_api_client.dart';
import 'data/gate_models.dart';

/// Gate In/Out home — scan or search a vehicle. Online-only authorization.
class GateHomeScreen extends ConsumerStatefulWidget {
  const GateHomeScreen({super.key});

  @override
  ConsumerState<GateHomeScreen> createState() => _GateHomeScreenState();
}

class _GateHomeScreenState extends ConsumerState<GateHomeScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<VehicleSummary> _results = [];
  bool _searching = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _runSearch(value);
    });
  }

  Future<void> _runSearch(String raw) async {
    final q = raw.trim();
    if (q.isEmpty) {
      setState(() {
        _results = [];
        _error = null;
        _searching = false;
      });
      return;
    }
    if (_isOffline) {
      setState(() {
        _error = 'Gate authorization requires connection';
        _results = [];
        _searching = false;
      });
      return;
    }
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final client = ref.read(gateApiClientProvider);
      final list = await client.searchVehicles(q);
      if (!mounted) return;
      setState(() {
        _results = list;
        _searching = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _searching = false;
        _results = [];
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _searching = false;
        _results = [];
      });
    }
  }

  void _openVehicle(String id) {
    if (_isOffline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Gate authorization requires connection'),
        ),
      );
      return;
    }
    context.push('/gate/vehicle/$id');
  }

  void _resolveManual(String raw) {
    final code = raw.trim();
    if (code.isEmpty) return;
    if (_isOffline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Gate authorization requires connection'),
        ),
      );
      return;
    }
    if (looksLikeVehicleId(code)) {
      _openVehicle(code);
      return;
    }
    _runSearch(code).then((_) {
      if (!mounted) return;
      if (_results.length == 1) {
        _openVehicle(_results.first.id);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final sync = ref.watch(syncControllerProvider);
    final offline = sync.phase == SyncPhase.offline;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Gate')),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          Text(
            'Vehicle gate',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: MpSpacing.xs),
          Text(
            'Authorize gate out and gate in against the live fleet record.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: MpSpacing.lg),
          if (offline)
            MpCard(
              color: scheme.errorContainer,
              child: Row(
                children: [
                  Icon(Icons.cloud_off, color: scheme.onErrorContainer),
                  const SizedBox(width: MpSpacing.md),
                  Expanded(
                    child: Text(
                      'Gate authorization requires connection',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: scheme.onErrorContainer,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          if (offline) const SizedBox(height: MpSpacing.lg),
          MpCard(
            onTap: offline ? null : () => context.push('/scan'),
            child: const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.qr_code_scanner),
              title: Text('Scan vehicle'),
              subtitle: Text('QR / barcode via Universal Scan'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const SizedBox(height: MpSpacing.md),
          const MpSectionHeader(
            title: 'Search vehicle',
            subtitle: 'Registration, make, model, or asset tag',
          ),
          MpTextField(
            controller: _searchController,
            label: 'Registration or ID',
            prefixIcon: Icons.search,
            enabled: !offline,
            textInputAction: TextInputAction.search,
            onChanged: _onQueryChanged,
            onSubmitted: _resolveManual,
          ),
          const SizedBox(height: MpSpacing.sm),
          MpButton(
            label: 'Look up',
            icon: Icons.directions_car_outlined,
            onPressed:
                offline ? null : () => _resolveManual(_searchController.text),
            isLoading: _searching,
          ),
          const SizedBox(height: MpSpacing.lg),
          if (_error != null)
            MpErrorState(
              title: 'Lookup failed',
              message: _error,
              onRetry: () => _runSearch(_searchController.text),
            )
          else if (_searching)
            const MpLoading(message: 'Searching vehicles…')
          else if (_results.isNotEmpty) ...[
            const MpSectionHeader(title: 'Matches'),
            for (final v in _results) ...[
              MpCard(
                onTap: () => _openVehicle(v.id),
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: scheme.primary.withValues(alpha: 0.12),
                    child: Icon(
                      Icons.local_shipping_outlined,
                      color: scheme.primary,
                    ),
                  ),
                  title: Text(v.displayLabel),
                  subtitle: Text(
                    [
                      if (v.status != null) v.status!,
                      if (v.make != null || v.vehicleModel != null)
                        [v.make, v.vehicleModel]
                            .whereType<String>()
                            .where((s) => s.isNotEmpty)
                            .join(' '),
                    ].where((s) => s.isNotEmpty).join(' · '),
                  ),
                  trailing: const Icon(Icons.chevron_right),
                ),
              ),
              const SizedBox(height: MpSpacing.sm),
            ],
          ] else if (_searchController.text.trim().isNotEmpty && !_searching)
            const MpEmptyState(
              title: 'No vehicles found',
              message: 'Try another registration or scan the vehicle QR.',
              icon: Icons.directions_car_outlined,
            ),
          const SizedBox(height: MpSpacing.xl),
          Text(
            AppStrings.onlineRequired,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: MpSpacing.sm),
          Text(
            'Gate actions are never queued offline.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}
