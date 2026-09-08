import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import '../work_orders/data/work_orders_repository.dart';
import 'data/gate_api_client.dart';
import 'data/gate_models.dart';

/// Gate-out form — online-only, Idempotency-Key + InFlightGuard.
class GateOutScreen extends ConsumerStatefulWidget {
  const GateOutScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  ConsumerState<GateOutScreen> createState() => _GateOutScreenState();
}

class _GateOutScreenState extends ConsumerState<GateOutScreen> {
  static const _uuid = Uuid();

  final _formKey = GlobalKey<FormState>();
  final _meterController = TextEditingController();
  final _driverController = TextEditingController();
  final _checkpointController = TextEditingController();
  final _gatePassController = TextEditingController();
  final _notesController = TextEditingController();
  final _overrideReasonController = TextEditingController();
  final _guard = InFlightGuard();

  GateEligibility? _eligibility;
  VehicleSummary? _vehicle;
  bool _loading = true;
  bool _submitting = false;
  bool _reconciling = false;
  bool _allowOverride = false;
  String? _error;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _meterController.dispose();
    _driverController.dispose();
    _checkpointController.dispose();
    _gatePassController.dispose();
    _notesController.dispose();
    _overrideReasonController.dispose();
    super.dispose();
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
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(gateApiClientProvider);
      final eligibility = await client.getEligibility(widget.vehicleId);
      final vehicle =
          eligibility.vehicle ?? await client.getVehicle(widget.vehicleId);
      if (!mounted) return;
      setState(() {
        _eligibility = eligibility;
        _vehicle = vehicle;
        if (_meterController.text.isEmpty && vehicle.currentMileage != null) {
          _meterController.text = vehicle.currentMileage!.toStringAsFixed(0);
        }
        if (_driverController.text.isEmpty &&
            vehicle.driverId != null &&
            vehicle.driverId!.isNotEmpty) {
          _driverController.text = vehicle.driverId!;
        }
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

  Future<void> _reconcileAuthoritativeStatus() async {
    setState(() {
      _reconciling = true;
      _statusMessage = 'Checking authoritative gate status';
    });
    try {
      final client = ref.read(gateApiClientProvider);
      final eligibility = await client.getEligibility(widget.vehicleId);
      final movements = await client.listMovements(widget.vehicleId, limit: 5);
      if (!mounted) return;
      setState(() {
        _eligibility = eligibility;
        _vehicle = eligibility.vehicle ?? _vehicle;
        _reconciling = false;
        final latest = movements.isNotEmpty ? movements.first : null;
        _statusMessage = latest == null
            ? 'Status refreshed from server'
            : 'Latest: ${latest.movementType ?? 'movement'} · ${latest.status ?? 'unknown'}';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _reconciling = false;
        _statusMessage =
            'Could not refresh status — check connection and try again';
      });
    }
  }

  Future<void> _submit() async {
    if (_isOffline) {
      setState(() => _error = 'Gate authorization requires connection');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final user = ref.read(authControllerProvider).user;
    final role = user?.role ?? '';
    final perms = user?.permissions ?? const [];
    final canOverrideUi = canShowGateOverrideUi(
      eligibilityCanOverride: _eligibility?.canOverride == true,
      userHasOverridePermission:
          _can(perms, role, MpPermissions.gateOverrideApprove),
    );

    if (_eligibility?.blocked == true &&
        canOverrideUi &&
        _allowOverride &&
        _overrideReasonController.text.trim().isEmpty) {
      setState(() => _error = 'Override reason is required');
      return;
    }

    final meter = double.tryParse(_meterController.text.trim());
    if (meter == null) {
      setState(() => _error = 'Enter a valid meter reading');
      return;
    }

    final idempotencyKey = _uuid.v4();
    setState(() {
      _submitting = true;
      _error = null;
      _statusMessage = null;
    });

    try {
      final result = await _guard.run(() async {
        final client = ref.read(gateApiClientProvider);
        return client.gateOut(
          widget.vehicleId,
          meterReading: meter,
          driverId: _driverController.text.trim().isEmpty
              ? null
              : _driverController.text.trim(),
          checkpoint: _checkpointController.text.trim().isEmpty
              ? null
              : _checkpointController.text.trim(),
          gatePassNo: _gatePassController.text.trim().isEmpty
              ? null
              : _gatePassController.text.trim(),
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
          allowOverride:
              canOverrideUi && _allowOverride && _eligibility?.blocked == true
                  ? true
                  : null,
          overrideReason:
              canOverrideUi && _allowOverride && _eligibility?.blocked == true
                  ? _overrideReasonController.text.trim()
                  : null,
          idempotencyKey: idempotencyKey,
        );
      });

      if (!mounted) return;

      if (result == null) {
        setState(() {
          _submitting = false;
          _statusMessage = 'Request already in progress';
        });
        return;
      }

      setState(() => _submitting = false);
      if (result.blocked && !result.allowed) {
        setState(() {
          _error = result.blockedReason ??
              (_eligibility?.blockReasons.isNotEmpty == true
                  ? _eligibility!.blockReasons.join('; ')
                  : 'Gate-out blocked');
        });
        await _reconcileAuthoritativeStatus();
        return;
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.idempotentReplay
                ? 'Gate-out already recorded (idempotent)'
                : result.overrideUsed
                    ? 'Gate-out recorded with override'
                    : 'Gate-out recorded',
          ),
        ),
      );
      context.pop(true);
    } on ConflictException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
      await _reconcileAuthoritativeStatus();
    } on NetworkException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
      await _reconcileAuthoritativeStatus();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
      if (e.statusCode == 409) {
        await _reconcileAuthoritativeStatus();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.toString();
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
    final canOverrideUi = canShowGateOverrideUi(
      eligibilityCanOverride: _eligibility?.canOverride == true,
      userHasOverridePermission:
          _can(perms, role, MpPermissions.gateOverrideApprove),
    );
    final blocked = _eligibility?.blocked == true;

    return Scaffold(
      appBar: AppBar(title: const Text('Gate Out')),
      body: _loading
          ? const MpLoading(message: 'Loading eligibility…')
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(MpSpacing.screenPadding),
                children: [
                  if (offline)
                    MpCard(
                      color: scheme.errorContainer,
                      child: Text(
                        'Gate authorization requires connection',
                        style: TextStyle(color: scheme.onErrorContainer),
                      ),
                    ),
                  if (_vehicle != null) ...[
                    Text(
                      _vehicle!.displayLabel,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: MpSpacing.xs),
                    Text(
                      'Current meter: ${_vehicle!.currentMileage?.toStringAsFixed(0) ?? '—'}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: MpSpacing.lg),
                  ],
                  if (blocked) ...[
                    MpCard(
                      color: scheme.errorContainer.withValues(alpha: 0.5),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Gate-out blocked',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: MpSpacing.sm),
                          for (final r
                              in _eligibility?.blockReasons ?? const <String>[])
                            Padding(
                              padding:
                                  const EdgeInsets.only(bottom: MpSpacing.xs),
                              child: Text('• $r'),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: MpSpacing.md),
                  ],
                  if (canOverrideUi && blocked) ...[
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _allowOverride,
                      onChanged: offline
                          ? null
                          : (v) => setState(() => _allowOverride = v ?? false),
                      title: const Text('Authorize override'),
                      subtitle: const Text(
                        'Requires gate.override.approve — approver is the signed-in user',
                      ),
                    ),
                    if (_allowOverride) ...[
                      MpTextField(
                        controller: _overrideReasonController,
                        label: 'Override reason',
                        maxLines: 3,
                        enabled: !offline,
                        validator: (v) {
                          if (_allowOverride &&
                              (v == null || v.trim().isEmpty)) {
                            return 'Override reason is required';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: MpSpacing.md),
                    ],
                  ],
                  MpTextField(
                    controller: _meterController,
                    label: 'Meter reading',
                    keyboardType: TextInputType.number,
                    enabled: !offline,
                    prefixIcon: Icons.speed,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'Meter reading is required';
                      }
                      if (double.tryParse(v.trim()) == null) {
                        return 'Enter a valid number';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: MpSpacing.md),
                  MpTextField(
                    controller: _driverController,
                    label: 'Driver ID (optional)',
                    enabled: !offline,
                    prefixIcon: Icons.person_outline,
                  ),
                  const SizedBox(height: MpSpacing.md),
                  MpTextField(
                    controller: _checkpointController,
                    label: 'Checkpoint (optional)',
                    enabled: !offline,
                    prefixIcon: Icons.place_outlined,
                  ),
                  const SizedBox(height: MpSpacing.md),
                  MpTextField(
                    controller: _gatePassController,
                    label: 'Gate pass no. (optional)',
                    enabled: !offline,
                    prefixIcon: Icons.confirmation_number_outlined,
                  ),
                  const SizedBox(height: MpSpacing.md),
                  MpTextField(
                    controller: _notesController,
                    label: 'Notes (optional)',
                    maxLines: 3,
                    enabled: !offline,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: MpSpacing.md),
                    Text(
                      _error!,
                      style: TextStyle(color: scheme.error),
                    ),
                  ],
                  if (_statusMessage != null) ...[
                    const SizedBox(height: MpSpacing.sm),
                    Text(
                      _statusMessage!,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: MpSpacing.xl),
                  MpButton(
                    label: blocked && _allowOverride && canOverrideUi
                        ? 'Confirm gate out (override)'
                        : 'Confirm gate out',
                    icon: Icons.logout,
                    isLoading: _submitting || _reconciling,
                    onPressed: offline ||
                            _submitting ||
                            (blocked && !(canOverrideUi && _allowOverride))
                        ? null
                        : _submit,
                  ),
                  if (blocked && !(canOverrideUi && _allowOverride)) ...[
                    const SizedBox(height: MpSpacing.sm),
                    Text(
                      canOverrideUi
                          ? 'Enable override to proceed, or resolve blockers first.'
                          : 'Gate-out is blocked. Override is not available for your account.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
