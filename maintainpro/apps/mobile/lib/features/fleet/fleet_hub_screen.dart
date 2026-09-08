import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import 'data/fleet_api_client.dart';
import 'data/fleet_models.dart';

/// Fleet hub — Vehicles, Drivers (elevated roles), Alerts, Gate link.
class FleetHubScreen extends ConsumerStatefulWidget {
  const FleetHubScreen({super.key});

  @override
  ConsumerState<FleetHubScreen> createState() => _FleetHubScreenState();
}

class _FleetHubScreenState extends ConsumerState<FleetHubScreen> {
  bool _loading = true;
  String? _error;
  FleetSummary? _summary;
  List<VehicleAlert> _alerts = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  bool _isAdmin(String role) => role == 'SUPER_ADMIN' || role == 'ADMIN';

  bool _can(List<String> perms, String role, String permission) {
    if (_isAdmin(role)) return true;
    return MpPermissions.has(perms, permission);
  }

  /// Drivers directory Nest roles: SUPER_ADMIN, ADMIN, ASSET_MANAGER.
  bool _canSeeDriversNav(String role) {
    final r = role.toUpperCase();
    return r == 'SUPER_ADMIN' || r == 'ADMIN' || r == 'ASSET_MANAGER';
  }

  Future<void> _load() async {
    if (_isOffline && _summary == null) {
      setState(() {
        _loading = false;
        _error = 'Fleet summary requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(fleetApiClientProvider);
      final summary = await client.getSummary();
      List<VehicleAlert> alerts = const [];
      try {
        alerts = await client.getAlerts(limit: 8);
      } catch (_) {
        // Alerts are best-effort on hub.
      }
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _alerts = alerts;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final role = user?.role ?? '';
    final perms = user?.permissions ?? const [];
    final sync = ref.watch(syncControllerProvider);
    final offline = sync.phase == SyncPhase.offline;
    final canView = _can(perms, role, MpPermissions.vehiclesView);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Fleet')),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          Text(
            'Vehicles & fleet',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: MpSpacing.xs),
          Text(
            'Operate trips, fuel, and meters against live Nest /vehicles APIs.',
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
                      'Mutations require connection. Cached reads may still show.',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: scheme.onErrorContainer,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          if (offline) const SizedBox(height: MpSpacing.lg),
          if (!canView)
            const MpErrorState(
              title: 'Vehicles access required',
              message:
                  'Your account needs vehicles.view (or admin) to use Fleet.',
            )
          else if (_loading)
            const MpLoading(message: 'Loading fleet…')
          else if (_error != null && _summary == null)
            MpErrorState(
              title: 'Fleet unavailable',
              message: _error,
              onRetry: _load,
            )
          else ...[
            if (_summary != null) ...[
              MpSectionHeader(
                title: 'Summary',
                subtitle: 'Live fleet counts',
                actionLabel: 'Refresh',
                onAction: offline ? null : _load,
              ),
              Wrap(
                spacing: MpSpacing.sm,
                runSpacing: MpSpacing.sm,
                children: [
                  MpStatusChip(
                    label: 'Total ${_summary!.totalVehicles ?? 0}',
                  ),
                  MpStatusChip(
                    label: 'Available ${_summary!.availableVehicles ?? 0}',
                  ),
                  MpStatusChip(
                    label: 'In use ${_summary!.vehiclesInUse ?? 0}',
                  ),
                  MpStatusChip(
                    label:
                        'Maintenance ${_summary!.vehiclesUnderMaintenance ?? 0}',
                  ),
                  if ((_summary!.overdueMaintenance ?? 0) > 0)
                    MpStatusChip(
                      label: 'Overdue ${_summary!.overdueMaintenance}',
                      tone: MpStatusTone.error,
                    ),
                ],
              ),
              const SizedBox(height: MpSpacing.lg),
            ],
            MpCard(
              onTap: () => context.push('/fleet/vehicles'),
              child: const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.directions_car_outlined),
                title: Text('Vehicles'),
                subtitle: Text('Search, status, operations'),
                trailing: Icon(Icons.chevron_right),
              ),
            ),
            const SizedBox(height: MpSpacing.md),
            if (_canSeeDriversNav(role))
              MpCard(
                onTap: () => context.push('/fleet/drivers'),
                child: const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.badge_outlined),
                  title: Text('Drivers'),
                  subtitle: Text('Directory (elevated role)'),
                  trailing: Icon(Icons.chevron_right),
                ),
              ),
            if (_canSeeDriversNav(role)) const SizedBox(height: MpSpacing.md),
            MpCard(
              onTap: () => context.push('/gate'),
              child: const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.local_shipping_outlined),
                title: Text('Gate'),
                subtitle: Text('Security check-in / check-out'),
                trailing: Icon(Icons.chevron_right),
              ),
            ),
            if (_alerts.isNotEmpty) ...[
              const SizedBox(height: MpSpacing.lg),
              const MpSectionHeader(
                title: 'Alerts',
                subtitle: 'Service status summary from server',
              ),
              ..._alerts.take(5).map(
                    (a) => Padding(
                      padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                      child: MpCard(
                        onTap: a.vehicleId == null || a.vehicleId!.isEmpty
                            ? null
                            : () =>
                                context.push('/fleet/vehicles/${a.vehicleId}'),
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            a.isCritical
                                ? Icons.warning_amber
                                : Icons.info_outline,
                            color: a.isCritical ? scheme.error : null,
                          ),
                          title: Text(a.title ?? a.type ?? 'Alert'),
                          subtitle: Text(
                            [
                              a.registrationNo,
                              a.message,
                            ]
                                .whereType<String>()
                                .where((s) => s.isNotEmpty)
                                .join(' · '),
                          ),
                          trailing: a.isCritical
                              ? const MpStatusChip(
                                  label: 'Critical',
                                  tone: MpStatusTone.error,
                                )
                              : null,
                        ),
                      ),
                    ),
                  ),
            ],
          ],
        ],
      ),
    );
  }
}
