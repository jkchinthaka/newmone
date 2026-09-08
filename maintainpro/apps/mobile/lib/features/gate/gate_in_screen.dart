import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import '../work_orders/data/work_orders_repository.dart';
import 'data/gate_api_client.dart';
import 'data/gate_models.dart';

/// Gate-in form — online-only, Idempotency-Key + InFlightGuard.
class GateInScreen extends ConsumerStatefulWidget {
  const GateInScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  ConsumerState<GateInScreen> createState() => _GateInScreenState();
}

class _GateInScreenState extends ConsumerState<GateInScreen> {
  static const _uuid = Uuid();

  final _formKey = GlobalKey<FormState>();
  final _meterController = TextEditingController();
  final _checkpointController = TextEditingController();
  final _notesController = TextEditingController();
  final _guard = InFlightGuard();

  VehicleSummary? _vehicle;
  bool _loading = true;
  bool _submitting = false;
  bool _reconciling = false;
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
    _checkpointController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

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
      final vehicle = await client.getVehicle(widget.vehicleId);
      if (!mounted) return;
      setState(() {
        _vehicle = vehicle;
        if (_meterController.text.isEmpty && vehicle.currentMileage != null) {
          _meterController.text = vehicle.currentMileage!.toStringAsFixed(0);
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
      final vehicle = await client.getVehicle(widget.vehicleId);
      final movements = await client.listMovements(widget.vehicleId, limit: 5);
      if (!mounted) return;
      setState(() {
        _vehicle = vehicle;
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
        return client.gateIn(
          widget.vehicleId,
          meterReading: meter,
          checkpoint: _checkpointController.text.trim().isEmpty
              ? null
              : _checkpointController.text.trim(),
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.idempotentReplay
                ? 'Gate-in already recorded (idempotent)'
                : 'Gate-in recorded',
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
    final offline =
        ref.watch(syncControllerProvider).phase == SyncPhase.offline;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Gate In')),
      body: _loading
          ? const MpLoading(message: 'Loading vehicle…')
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
                    controller: _checkpointController,
                    label: 'Checkpoint (optional)',
                    enabled: !offline,
                    prefixIcon: Icons.place_outlined,
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
                    Text(_error!, style: TextStyle(color: scheme.error)),
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
                    label: 'Confirm gate in',
                    icon: Icons.login,
                    isLoading: _submitting || _reconciling,
                    onPressed: offline || _submitting ? null : _submit,
                  ),
                ],
              ),
            ),
    );
  }
}
