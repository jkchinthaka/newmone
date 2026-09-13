import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import '../work_orders/data/work_orders_repository.dart';
import 'data/fleet_api_client.dart';

/// Start trip — online-only, InFlightGuard, no occurredAt / Idempotency-Key.
class TripStartScreen extends ConsumerStatefulWidget {
  const TripStartScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  ConsumerState<TripStartScreen> createState() => _TripStartScreenState();
}

class _TripStartScreenState extends ConsumerState<TripStartScreen> {
  final _formKey = GlobalKey<FormState>();
  final _driverController = TextEditingController();
  final _startLocController = TextEditingController();
  final _endLocController = TextEditingController();
  final _mileageController = TextEditingController();
  final _purposeController = TextEditingController();
  final _guard = InFlightGuard();

  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _preload());
  }

  @override
  void dispose() {
    _driverController.dispose();
    _startLocController.dispose();
    _endLocController.dispose();
    _mileageController.dispose();
    _purposeController.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _preload() async {
    if (_isOffline) {
      setState(() {
        _loading = false;
        _error = 'Trip start requires connection';
      });
      return;
    }
    try {
      final v =
          await ref.read(fleetApiClientProvider).getVehicle(widget.vehicleId);
      if (!mounted) return;
      if (v.driverId != null) _driverController.text = v.driverId!;
      if (v.currentMileage != null) {
        _mileageController.text = v.currentMileage!.toStringAsFixed(0);
      }
      setState(() => _loading = false);
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

  Future<void> _submit() async {
    if (_isOffline) {
      setState(() => _error = 'Trip start requires connection');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final mileage = double.tryParse(_mileageController.text.trim());
    if (mileage == null) {
      setState(() => _error = 'Enter a valid start mileage');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await _guard.run(() async {
        return ref.read(fleetApiClientProvider).tripStart(
              widget.vehicleId,
              driverId: _driverController.text.trim(),
              startLocation: _startLocController.text.trim(),
              endLocation: _endLocController.text.trim(),
              startMileage: mileage,
              purpose: _purposeController.text.trim().isEmpty
                  ? null
                  : _purposeController.text.trim(),
            );
      });

      if (!mounted) return;
      if (result == null) {
        setState(() {
          _submitting = false;
          _error = 'Request already in progress';
        });
        return;
      }

      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Trip started')),
      );
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
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

    return Scaffold(
      appBar: AppBar(title: const Text('Start trip')),
      body: _loading
          ? const MpLoading(message: 'Preparing…')
          : ListView(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              children: [
                if (offline || _error != null)
                  MpCard(
                    color: Theme.of(context).colorScheme.errorContainer,
                    child: Text(
                      offline
                          ? 'Trip start requires connection (not queued offline)'
                          : _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                if (offline || _error != null)
                  const SizedBox(height: MpSpacing.md),
                Text(
                  'Server timestamps the trip. Do not send occurredAt. '
                  'No Idempotency-Key — double-submit blocked by InFlightGuard.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: MpSpacing.lg),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      MpTextField(
                        controller: _driverController,
                        label: 'Driver ID',
                        enabled: !offline && !_submitting,
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _startLocController,
                        label: 'Start location',
                        enabled: !offline && !_submitting,
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _endLocController,
                        label: 'End location',
                        enabled: !offline && !_submitting,
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _mileageController,
                        label: 'Start mileage',
                        keyboardType: TextInputType.number,
                        enabled: !offline && !_submitting,
                        validator: (v) =>
                            (v == null || double.tryParse(v.trim()) == null)
                                ? 'Required number'
                                : null,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _purposeController,
                        label: 'Purpose (optional)',
                        enabled: !offline && !_submitting,
                      ),
                      const SizedBox(height: MpSpacing.xl),
                      MpButton(
                        label: 'Start trip',
                        icon: Icons.play_arrow,
                        isLoading: _submitting,
                        onPressed: offline || _submitting ? null : _submit,
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
