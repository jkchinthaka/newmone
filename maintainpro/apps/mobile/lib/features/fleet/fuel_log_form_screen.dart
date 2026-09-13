import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import '../work_orders/data/work_orders_repository.dart';
import 'data/fleet_api_client.dart';

/// Fuel log — online-only; clientActionId UUID; InFlightGuard.
class FuelLogFormScreen extends ConsumerStatefulWidget {
  const FuelLogFormScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  ConsumerState<FuelLogFormScreen> createState() => _FuelLogFormScreenState();
}

class _FuelLogFormScreenState extends ConsumerState<FuelLogFormScreen> {
  static const _uuid = Uuid();

  final _formKey = GlobalKey<FormState>();
  final _litersController = TextEditingController();
  final _costController = TextEditingController();
  final _mileageController = TextEditingController();
  final _driverController = TextEditingController();
  final _stationController = TextEditingController();
  final _notesController = TextEditingController();
  final _guard = InFlightGuard();

  late final String _clientActionId;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _clientActionId = _uuid.v4();
    WidgetsBinding.instance.addPostFrameCallback((_) => _preload());
  }

  @override
  void dispose() {
    _litersController.dispose();
    _costController.dispose();
    _mileageController.dispose();
    _driverController.dispose();
    _stationController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _preload() async {
    if (_isOffline) {
      setState(() {
        _loading = false;
        _error = 'Fuel log requires connection';
      });
      return;
    }
    try {
      final v =
          await ref.read(fleetApiClientProvider).getVehicle(widget.vehicleId);
      if (!mounted) return;
      if (v.currentMileage != null) {
        _mileageController.text = v.currentMileage!.toStringAsFixed(0);
      }
      if (v.driverId != null) _driverController.text = v.driverId!;
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
      setState(() => _error = 'Fuel log requires connection');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final liters = double.tryParse(_litersController.text.trim());
    final cost = double.tryParse(_costController.text.trim());
    final mileage = double.tryParse(_mileageController.text.trim());
    if (liters == null || cost == null || mileage == null) {
      setState(() => _error = 'Enter valid numbers');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await _guard.run(() async {
        return ref.read(fleetApiClientProvider).fuelLog(
              widget.vehicleId,
              liters: liters,
              costPerLiter: cost,
              mileageAtFuel: mileage,
              driverId: _driverController.text.trim().isEmpty
                  ? null
                  : _driverController.text.trim(),
              fuelStation: _stationController.text.trim().isEmpty
                  ? null
                  : _stationController.text.trim(),
              notes: _notesController.text.trim().isEmpty
                  ? null
                  : _notesController.text.trim(),
              clientActionId: _clientActionId,
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
        const SnackBar(content: Text('Fuel log recorded')),
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
      appBar: AppBar(title: const Text('Fuel log')),
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
                          ? 'Fuel log requires connection (not queued offline)'
                          : _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                if (offline || _error != null)
                  const SizedBox(height: MpSpacing.md),
                Text(
                  'clientActionId: $_clientActionId',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: MpSpacing.lg),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      MpTextField(
                        controller: _litersController,
                        label: 'Liters',
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        enabled: !offline && !_submitting,
                        validator: (v) =>
                            (v == null || double.tryParse(v.trim()) == null)
                                ? 'Required'
                                : null,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _costController,
                        label: 'Cost per liter',
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        enabled: !offline && !_submitting,
                        validator: (v) =>
                            (v == null || double.tryParse(v.trim()) == null)
                                ? 'Required'
                                : null,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _mileageController,
                        label: 'Mileage at fuel',
                        keyboardType: TextInputType.number,
                        enabled: !offline && !_submitting,
                        validator: (v) =>
                            (v == null || double.tryParse(v.trim()) == null)
                                ? 'Required'
                                : null,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _driverController,
                        label: 'Driver ID (optional)',
                        enabled: !offline && !_submitting,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _stationController,
                        label: 'Fuel station (optional)',
                        enabled: !offline && !_submitting,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _notesController,
                        label: 'Notes (optional)',
                        enabled: !offline && !_submitting,
                        maxLines: 2,
                      ),
                      const SizedBox(height: MpSpacing.xl),
                      MpButton(
                        label: 'Save fuel log',
                        icon: Icons.local_gas_station,
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
