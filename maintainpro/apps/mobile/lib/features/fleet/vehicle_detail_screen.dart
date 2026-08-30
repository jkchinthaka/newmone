import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import '../gate/data/gate_models.dart';
import 'data/fleet_api_client.dart';
import 'data/fleet_models.dart';

/// Vehicle detail — overview, service, operations, history.
class VehicleDetailScreen extends ConsumerStatefulWidget {
  const VehicleDetailScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  ConsumerState<VehicleDetailScreen> createState() =>
      _VehicleDetailScreenState();
}

class _VehicleDetailScreenState extends ConsumerState<VehicleDetailScreen> {
  bool _loading = true;
  String? _error;
  Vehicle? _vehicle;
  FuelAnalytics? _analytics;
  List<TripLog> _trips = const [];
  List<FuelLog> _fuelLogs = const [];
  List<MeterLog> _meterLogs = const [];
  List<GateMovement> _gateMovements = const [];
  List<VehicleAlert> _alerts = const [];
  int _historyTab = 0;

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
    if (_isOffline && _vehicle == null) {
      setState(() {
        _loading = false;
        _error = 'Vehicle detail requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(fleetApiClientProvider);
      final vehicle = await client.getVehicle(widget.vehicleId);
      FuelAnalytics? analytics;
      List<TripLog> trips = const [];
      List<FuelLog> fuel = const [];
      List<MeterLog> meters = const [];
      List<GateMovement> gates = const [];
      List<VehicleAlert> alerts = const [];
      try {
        analytics = await client.fuelAnalytics(widget.vehicleId);
      } catch (_) {}
      try {
        trips = await client.listTrips(widget.vehicleId);
      } catch (_) {}
      try {
        fuel = await client.listFuelLogs(widget.vehicleId);
      } catch (_) {}
      try {
        meters = await client.listMeterLogs(widget.vehicleId);
      } catch (_) {}
      try {
        gates = await client.listGateMovements(widget.vehicleId);
      } catch (_) {}
      try {
        final all = await client.getAlerts(limit: 50);
        alerts = all.where((a) => a.vehicleId == widget.vehicleId).toList();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _vehicle = vehicle;
        _analytics = analytics;
        _trips = trips;
        _fuelLogs = fuel;
        _meterLogs = meters;
        _gateMovements = gates;
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

  VehicleHealthLabel get _health {
    final hasCritical = _alerts.any((a) => a.isCritical);
    return healthFromServiceStatus(
      _vehicle?.serviceStatus,
      hasCriticalAlert: hasCritical,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final role = user?.role ?? '';
    final perms = user?.permissions ?? const [];
    final offline =
        ref.watch(syncControllerProvider).phase == SyncPhase.offline;
    final canOperate = _can(perms, role, MpPermissions.vehiclesOperate);
    final canView = _can(perms, role, MpPermissions.vehiclesView);
    final canGate = _can(perms, role, MpPermissions.gateInCreate) ||
        _can(perms, role, MpPermissions.gateOutCreate);
    final scheme = Theme.of(context).colorScheme;
    final v = _vehicle;
    TripLog? activeTrip;
    for (final t in _trips) {
      if (t.isInProgress) {
        activeTrip = t;
        break;
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(v?.displayLabel ?? 'Vehicle'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: offline ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const MpLoading(message: 'Loading vehicle…')
          : _error != null && v == null
              ? MpErrorState(
                  title: 'Vehicle unavailable',
                  message: _error,
                  onRetry: _load,
                )
              : ListView(
                  padding: const EdgeInsets.all(MpSpacing.screenPadding),
                  children: [
                    if (offline)
                      MpCard(
                        color: scheme.errorContainer,
                        child: Text(
                          'Online required for trip, fuel, meter, and assign-driver.',
                          style: TextStyle(color: scheme.onErrorContainer),
                        ),
                      ),
                    if (offline) const SizedBox(height: MpSpacing.md),
                    Text(
                      v?.displayLabel ?? widget.vehicleId,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: MpSpacing.sm),
                    Wrap(
                      spacing: MpSpacing.sm,
                      runSpacing: MpSpacing.xs,
                      children: [
                        if (v?.status != null)
                          MpStatusChip(
                            label: v!.status!.replaceAll('_', ' '),
                          ),
                        MpStatusChip(
                          label: 'Status summary: ${healthLabelText(_health)}',
                          tone: switch (_health) {
                            VehicleHealthLabel.critical => MpStatusTone.error,
                            VehicleHealthLabel.attention =>
                              MpStatusTone.warning,
                            VehicleHealthLabel.healthy => MpStatusTone.success,
                          },
                        ),
                        if (v?.serviceStatus != null)
                          MpStatusChip(
                            label: 'Service ${v!.serviceStatus}',
                          ),
                      ],
                    ),
                    const SizedBox(height: MpSpacing.xs),
                    Text(
                      'Health label maps server serviceStatus / alerts only '
                      '(overdue→Critical, dueSoon→Attention).',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: MpSpacing.lg),
                    const MpSectionHeader(title: 'Overview'),
                    MpCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _kv('Make / model',
                              '${v?.make ?? '—'} ${v?.vehicleModel ?? ''}'),
                          _kv('Mileage',
                              v?.currentMileage?.toStringAsFixed(0) ?? '—'),
                          _kv('Driver',
                              v?.driverName ?? v?.driverId ?? 'Unassigned'),
                          _kv('Asset tag', v?.assetTag ?? '—'),
                          _kv('Location', v?.location ?? '—'),
                          _kv('Type', v?.type ?? '—'),
                        ],
                      ),
                    ),
                    const MpSectionHeader(title: 'Service'),
                    MpCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _kv('Next service date', v?.nextServiceDate ?? '—'),
                          _kv(
                            'Next service mileage',
                            v?.nextServiceMileage?.toStringAsFixed(0) ?? '—',
                          ),
                          _kv('Last service', v?.lastServiceDate ?? '—'),
                          _kv(
                            'Interval (days / km)',
                            '${v?.serviceIntervalDays ?? '—'} / ${v?.serviceIntervalMileage?.toStringAsFixed(0) ?? '—'}',
                          ),
                        ],
                      ),
                    ),
                    if (canView && _analytics != null) ...[
                      const MpSectionHeader(title: 'Fuel analytics'),
                      MpCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _kv(
                              'Total liters',
                              _analytics!.totalLiters?.toStringAsFixed(1) ??
                                  '—',
                            ),
                            _kv(
                              'Total cost',
                              _analytics!.totalCost?.toStringAsFixed(2) ?? '—',
                            ),
                            _kv(
                              'L/100km',
                              (_analytics!.averageConsumptionLPer100Km ??
                                          _analytics!.avgConsumption)
                                      ?.toStringAsFixed(1) ??
                                  '—',
                            ),
                            _kv(
                              'Cost / km',
                              _analytics!.costPerKm?.toStringAsFixed(2) ?? '—',
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (canOperate) ...[
                      const MpSectionHeader(
                        title: 'Operations',
                        subtitle: 'Online-only · InFlightGuard on submit',
                      ),
                      Wrap(
                        spacing: MpSpacing.sm,
                        runSpacing: MpSpacing.sm,
                        children: [
                          MpButton(
                            label: 'Start trip',
                            expand: false,
                            icon: Icons.play_arrow,
                            onPressed: offline
                                ? null
                                : () => context.push(
                                      '/fleet/vehicles/${widget.vehicleId}/trip-start',
                                    ),
                          ),
                          MpButton(
                            label: 'End trip',
                            expand: false,
                            variant: MpButtonVariant.tonal,
                            icon: Icons.stop,
                            onPressed: offline || activeTrip == null
                                ? null
                                : () => context.push(
                                      '/fleet/vehicles/${widget.vehicleId}/trip-end',
                                    ),
                          ),
                          MpButton(
                            label: 'Fuel log',
                            expand: false,
                            variant: MpButtonVariant.outlined,
                            icon: Icons.local_gas_station,
                            onPressed: offline
                                ? null
                                : () => context.push(
                                      '/fleet/vehicles/${widget.vehicleId}/fuel',
                                    ),
                          ),
                          MpButton(
                            label: 'Meter',
                            expand: false,
                            variant: MpButtonVariant.outlined,
                            icon: Icons.speed,
                            onPressed: offline
                                ? null
                                : () => context.push(
                                      '/fleet/vehicles/${widget.vehicleId}/meter',
                                    ),
                          ),
                          if (canGate)
                            MpButton(
                              label: 'Gate',
                              expand: false,
                              variant: MpButtonVariant.tonal,
                              icon: Icons.local_shipping_outlined,
                              onPressed: () => context.push(
                                '/gate/vehicle/${widget.vehicleId}',
                              ),
                            ),
                        ],
                      ),
                      if (activeTrip != null)
                        Padding(
                          padding: const EdgeInsets.only(top: MpSpacing.sm),
                          child: Text(
                            'Active trip ${activeTrip.id} in progress',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                    ],
                    const MpSectionHeader(title: 'History'),
                    SegmentedButton<int>(
                      segments: const [
                        ButtonSegment(value: 0, label: Text('Trips')),
                        ButtonSegment(value: 1, label: Text('Fuel')),
                        ButtonSegment(value: 2, label: Text('Meter')),
                        ButtonSegment(value: 3, label: Text('Gate')),
                      ],
                      selected: {_historyTab},
                      onSelectionChanged: (s) =>
                          setState(() => _historyTab = s.first),
                    ),
                    const SizedBox(height: MpSpacing.md),
                    ..._historyChildren(),
                  ],
                ),
    );
  }

  List<Widget> _historyChildren() {
    switch (_historyTab) {
      case 1:
        if (_fuelLogs.isEmpty) {
          return [const MpEmptyState(title: 'No fuel logs')];
        }
        return _fuelLogs
            .map(
              (f) => Padding(
                padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                child: MpCard(
                  child: Text(
                    '${f.date ?? '—'} · ${f.liters?.toStringAsFixed(1) ?? '—'} L · '
                    '${f.mileageAtFuel?.toStringAsFixed(0) ?? '—'} km'
                    '${f.fuelStation != null ? ' · ${f.fuelStation}' : ''}',
                  ),
                ),
              ),
            )
            .toList();
      case 2:
        if (_meterLogs.isEmpty) {
          return [const MpEmptyState(title: 'No meter logs')];
        }
        return _meterLogs
            .map(
              (m) => Padding(
                padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                child: MpCard(
                  child: Text(
                    '${m.createdAt ?? '—'} · ${m.reading?.toStringAsFixed(0) ?? '—'} '
                    '(${m.readingType ?? m.source ?? 'reading'})',
                  ),
                ),
              ),
            )
            .toList();
      case 3:
        if (_gateMovements.isEmpty) {
          return [const MpEmptyState(title: 'No gate movements')];
        }
        return _gateMovements
            .map(
              (g) => Padding(
                padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                child: MpCard(
                  child: Text(
                    '${g.occurredAt ?? '—'} · ${g.movementType ?? '—'} · '
                    '${g.status ?? '—'} · meter ${g.meterReading ?? '—'}',
                  ),
                ),
              ),
            )
            .toList();
      default:
        if (_trips.isEmpty) {
          return [const MpEmptyState(title: 'No trips')];
        }
        return _trips
            .map(
              (t) => Padding(
                padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                child: MpCard(
                  child: Text(
                    '${t.status ?? '—'} · ${t.startLocation ?? '—'} → '
                    '${t.endLocation ?? '—'} · '
                    '${t.startMileage?.toStringAsFixed(0) ?? '—'}–'
                    '${t.endMileage?.toStringAsFixed(0) ?? '—'} km',
                  ),
                ),
              ),
            )
            .toList();
    }
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MpSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              k,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),
          Expanded(child: Text(v)),
        ],
      ),
    );
  }
}
