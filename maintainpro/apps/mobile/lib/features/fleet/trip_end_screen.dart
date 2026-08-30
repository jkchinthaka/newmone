import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import '../work_orders/data/work_orders_repository.dart';
import 'data/fleet_api_client.dart';
import 'data/fleet_models.dart';

/// End trip — finds IN_PROGRESS trip; online-only; InFlightGuard.
class TripEndScreen extends ConsumerStatefulWidget {
  const TripEndScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  ConsumerState<TripEndScreen> createState() => _TripEndScreenState();
}

class _TripEndScreenState extends ConsumerState<TripEndScreen> {
  final _formKey = GlobalKey<FormState>();
  final _mileageController = TextEditingController();
  final _notesController = TextEditingController();
  final _guard = InFlightGuard();

  bool _loading = true;
  bool _submitting = false;
  String? _error;
  TripLog? _activeTrip;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _mileageController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _load() async {
    if (_isOffline) {
      setState(() {
        _loading = false;
        _error = 'Trip end requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(fleetApiClientProvider);
      final trips = await client.listTrips(widget.vehicleId);
      TripLog? active;
      for (final t in trips) {
        if (t.isInProgress) {
          active = t;
          break;
        }
      }
      final vehicle = await client.getVehicle(widget.vehicleId);
      if (!mounted) return;
      if (vehicle.currentMileage != null) {
        _mileageController.text = vehicle.currentMileage!.toStringAsFixed(0);
      }
      setState(() {
        _activeTrip = active;
        _loading = false;
        if (active == null) {
          _error = 'No IN_PROGRESS trip found for this vehicle';
        }
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

  Future<void> _submit() async {
    if (_isOffline) {
      setState(() => _error = 'Trip end requires connection');
      return;
    }
    final trip = _activeTrip;
    if (trip == null) {
      setState(() => _error = 'No IN_PROGRESS trip to end');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final mileage = double.tryParse(_mileageController.text.trim());
    if (mileage == null) {
      setState(() => _error = 'Enter a valid end mileage');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await _guard.run(() async {
        return ref.read(fleetApiClientProvider).tripEnd(
              widget.vehicleId,
              tripId: trip.id,
              endMileage: mileage,
              notes: _notesController.text.trim().isEmpty
                  ? null
                  : _notesController.text.trim(),
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
        const SnackBar(content: Text('Trip ended')),
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
    final trip = _activeTrip;

    return Scaffold(
      appBar: AppBar(title: const Text('End trip')),
      body: _loading
          ? const MpLoading(message: 'Finding active trip…')
          : ListView(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              children: [
                if (offline || _error != null)
                  MpCard(
                    color: Theme.of(context).colorScheme.errorContainer,
                    child: Text(
                      offline
                          ? 'Trip end requires connection (not queued offline)'
                          : _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                if (offline || _error != null)
                  const SizedBox(height: MpSpacing.md),
                if (trip != null) ...[
                  Text(
                    'Active trip ${trip.id}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: MpSpacing.xs),
                  Text(
                    '${trip.startLocation ?? '—'} → ${trip.endLocation ?? '—'} · '
                    'start ${trip.startMileage?.toStringAsFixed(0) ?? '—'} km',
                  ),
                  const SizedBox(height: MpSpacing.md),
                ],
                Text(
                  'No occurredAt from device. No Idempotency-Key — '
                  'InFlightGuard only.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: MpSpacing.lg),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      MpTextField(
                        controller: _mileageController,
                        label: 'End mileage',
                        keyboardType: TextInputType.number,
                        enabled: !offline && !_submitting && trip != null,
                        validator: (v) =>
                            (v == null || double.tryParse(v.trim()) == null)
                                ? 'Required number'
                                : null,
                      ),
                      const SizedBox(height: MpSpacing.md),
                      MpTextField(
                        controller: _notesController,
                        label: 'Notes (optional)',
                        enabled: !offline && !_submitting && trip != null,
                        maxLines: 3,
                      ),
                      const SizedBox(height: MpSpacing.xl),
                      MpButton(
                        label: 'End trip',
                        icon: Icons.stop,
                        isLoading: _submitting,
                        onPressed: offline || _submitting || trip == null
                            ? null
                            : _submit,
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
