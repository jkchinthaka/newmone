import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import 'data/gate_api_client.dart';
import 'data/gate_models.dart';

/// Vehicle gate detail — eligibility, actions, recent movements.
class GateVehicleScreen extends ConsumerStatefulWidget {
  const GateVehicleScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  ConsumerState<GateVehicleScreen> createState() => _GateVehicleScreenState();
}

class _GateVehicleScreenState extends ConsumerState<GateVehicleScreen> {
  bool _loading = true;
  String? _error;
  VehicleSummary? _vehicle;
  GateEligibility? _eligibility;
  List<GateMovement> _movements = [];

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

  Future<void> _load() async {
    if (_isOffline) {
      setState(() {
        _loading = false;
        _error = 'Gate authorization requires connection';
        _vehicle = null;
        _eligibility = null;
        _movements = [];
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(gateApiClientProvider);
      final id = widget.vehicleId;
      final results = await Future.wait([
        client.getVehicle(id),
        client.getEligibility(id),
        client.listMovements(id),
      ]);
      if (!mounted) return;
      setState(() {
        _vehicle = results[0] as VehicleSummary;
        _eligibility = results[1] as GateEligibility;
        _movements = results[2] as List<GateMovement>;
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
    final offline =
        ref.watch(syncControllerProvider).phase == SyncPhase.offline;
    final scheme = Theme.of(context).colorScheme;

    final vehicle = _eligibility?.vehicle ?? _vehicle;
    final eligibility = _eligibility;
    final canOut = _can(perms, role, MpPermissions.gateOutCreate);
    final canIn = _can(perms, role, MpPermissions.gateInCreate);
    final canOverridePerm =
        _can(perms, role, MpPermissions.gateOverrideApprove);

    return Scaffold(
      appBar: AppBar(
        title: Text(vehicle?.displayLabel ?? 'Vehicle gate'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const MpLoading(message: 'Loading gate status…')
          : ListView(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              children: [
                if (offline ||
                    _error == 'Gate authorization requires connection')
                  MpCard(
                    color: scheme.errorContainer,
                    child: Text(
                      'Gate authorization requires connection',
                      style: TextStyle(color: scheme.onErrorContainer),
                    ),
                  ),
                if (_error != null &&
                    _error != 'Gate authorization requires connection')
                  MpErrorState(
                    title: 'Unable to load',
                    message: _error,
                    onRetry: _load,
                  )
                else if (vehicle != null) ...[
                  MpCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          vehicle.displayLabel,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: MpSpacing.xs),
                        Text(
                          [
                            if (vehicle.make != null ||
                                vehicle.vehicleModel != null)
                              [vehicle.make, vehicle.vehicleModel]
                                  .whereType<String>()
                                  .where((s) => s.isNotEmpty)
                                  .join(' '),
                            if (vehicle.status != null) vehicle.status!,
                          ].where((s) => s.isNotEmpty).join(' · '),
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: MpSpacing.md),
                        _MetaRow(
                          label: 'Current meter',
                          value: vehicle.currentMileage != null
                              ? vehicle.currentMileage!.toStringAsFixed(0)
                              : '—',
                        ),
                        _MetaRow(
                          label: 'Driver',
                          value: vehicle.driverId?.isNotEmpty == true
                              ? vehicle.driverId!
                              : 'Unassigned',
                        ),
                        if (vehicle.serviceStatus != null)
                          _MetaRow(
                            label: 'Service',
                            value: vehicle.serviceStatus!,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: MpSpacing.lg),
                  const MpSectionHeader(title: 'Eligibility'),
                  if (eligibility != null) ...[
                    MpCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          MpStatusChip(
                            label: eligibility.blocked
                                ? 'Blocked'
                                : eligibility.allowed
                                    ? 'Allowed'
                                    : 'Review required',
                            tone: eligibility.blocked
                                ? MpStatusTone.error
                                : eligibility.allowed
                                    ? MpStatusTone.success
                                    : MpStatusTone.warning,
                          ),
                          if (eligibility.blockReasons.isNotEmpty) ...[
                            const SizedBox(height: MpSpacing.md),
                            Text(
                              'Blocked reasons',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            const SizedBox(height: MpSpacing.xs),
                            for (final reason in eligibility.blockReasons)
                              Padding(
                                padding: const EdgeInsets.only(
                                  bottom: MpSpacing.xs,
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(
                                      Icons.block,
                                      size: 18,
                                      color: scheme.error,
                                    ),
                                    const SizedBox(width: MpSpacing.sm),
                                    Expanded(child: Text(reason)),
                                  ],
                                ),
                              ),
                          ],
                          if (canShowGateOverrideUi(
                            eligibilityCanOverride: eligibility.canOverride,
                            userHasOverridePermission: canOverridePerm,
                          )) ...[
                            const SizedBox(height: MpSpacing.sm),
                            Text(
                              'Override available for authorized officers',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: scheme.onSurfaceVariant),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: MpSpacing.lg),
                  const MpSectionHeader(title: 'Actions'),
                  if (canOut)
                    MpButton(
                      label: 'Gate Out',
                      icon: Icons.logout,
                      onPressed: offline
                          ? null
                          : () async {
                              await context.push(
                                '/gate/vehicle/${widget.vehicleId}/out',
                              );
                              if (mounted) _load();
                            },
                    ),
                  if (canOut && canIn) const SizedBox(height: MpSpacing.sm),
                  if (canIn)
                    MpButton(
                      label: 'Gate In',
                      icon: Icons.login,
                      variant: MpButtonVariant.tonal,
                      onPressed: offline
                          ? null
                          : () async {
                              await context.push(
                                '/gate/vehicle/${widget.vehicleId}/in',
                              );
                              if (mounted) _load();
                            },
                    ),
                  if (!canOut && !canIn)
                    const MpEmptyState(
                      title: 'No gate actions',
                      message:
                          'Your account needs gate.out.create or gate.in.create.',
                      icon: Icons.lock_outline,
                    ),
                  const SizedBox(height: MpSpacing.xl),
                  const MpSectionHeader(title: 'Recent movements'),
                  if (_movements.isEmpty)
                    const MpEmptyState(
                      title: 'No movements yet',
                      message: 'Gate history will appear here.',
                      icon: Icons.history,
                    )
                  else
                    for (final m in _movements) ...[
                      MpCard(
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            m.isOut
                                ? Icons.logout
                                : m.isIn
                                    ? Icons.login
                                    : Icons.swap_horiz,
                          ),
                          title: Text(
                            [
                              m.movementType ?? 'Movement',
                              if (m.status != null) m.status!,
                            ].join(' · '),
                          ),
                          subtitle: Text(
                            [
                              if (m.meterReading != null)
                                'Meter ${m.meterReading!.toStringAsFixed(0)}',
                              if (m.checkpoint != null) m.checkpoint!,
                              if (m.blockedReason != null) m.blockedReason!,
                              if (m.occurredAt != null) m.occurredAt!,
                            ].where((s) => s.isNotEmpty).join(' · '),
                          ),
                        ),
                      ),
                      const SizedBox(height: MpSpacing.sm),
                    ],
                ],
              ],
            ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MpSpacing.xs),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
        ],
      ),
    );
  }
}
