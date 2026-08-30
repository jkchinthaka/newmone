import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import '../work_orders/data/work_orders_repository.dart';
import 'data/fleet_api_client.dart';

/// Meter reading — online-only; InFlightGuard; no server Idempotency-Key.
class MeterReadingFormScreen extends ConsumerStatefulWidget {
  const MeterReadingFormScreen({super.key, required this.vehicleId});

  final String vehicleId;

  @override
  ConsumerState<MeterReadingFormScreen> createState() =>
      _MeterReadingFormScreenState();
}

class _MeterReadingFormScreenState
    extends ConsumerState<MeterReadingFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _readingController = TextEditingController();
  final _notesController = TextEditingController();
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
    _readingController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _preload() async {
    if (_isOffline) {
      setState(() {
        _loading = false;
        _error = 'Meter reading requires connection';
      });
      return;
    }
    try {
      final v =
          await ref.read(fleetApiClientProvider).getVehicle(widget.vehicleId);
      if (!mounted) return;
      if (v.currentMileage != null) {
        _readingController.text = v.currentMileage!.toStringAsFixed(0);
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
      setState(() => _error = 'Meter reading requires connection');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final reading = double.tryParse(_readingController.text.trim());
    if (reading == null) {
      setState(() => _error = 'Enter a valid reading');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await _guard.run(() async {
        return ref.read(fleetApiClientProvider).meterReading(
              widget.vehicleId,
              reading,
              notes: _notesController.text.trim().isEmpty
                  ? null
                  : _notesController.text.trim(),
              source: 'mobile',
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
        const SnackBar(content: Text('Meter reading recorded')),
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
      appBar: AppBar(title: const Text('Meter reading')),
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
                          ? 'Meter reading requires connection (not queued offline)'
                          : _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                if (offline || _error != null)
                  const SizedBox(height: MpSpacing.md),
                Text(
                  'No server Idempotency-Key for meter — InFlightGuard only.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: MpSpacing.lg),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      MpTextField(
                        controller: _readingController,
                        label: 'Reading',
                        keyboardType: TextInputType.number,
                        enabled: !offline && !_submitting,
                        validator: (v) =>
                            (v == null || double.tryParse(v.trim()) == null)
                                ? 'Required number'
                                : null,
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
                        label: 'Save reading',
                        icon: Icons.speed,
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
