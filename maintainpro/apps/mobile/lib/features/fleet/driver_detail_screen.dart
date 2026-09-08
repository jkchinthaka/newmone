import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/fleet_api_client.dart';
import 'data/fleet_models.dart';

class DriverDetailScreen extends ConsumerStatefulWidget {
  const DriverDetailScreen({super.key, required this.driverId});

  final String driverId;

  @override
  ConsumerState<DriverDetailScreen> createState() => _DriverDetailScreenState();
}

class _DriverDetailScreenState extends ConsumerState<DriverDetailScreen> {
  bool _loading = true;
  String? _error;
  bool _forbidden = false;
  DriverSummary? _driver;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _load() async {
    if (_isOffline) {
      setState(() {
        _loading = false;
        _error = 'Driver detail requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _forbidden = false;
    });
    try {
      final d =
          await ref.read(fleetApiClientProvider).getDriver(widget.driverId);
      if (!mounted) return;
      setState(() {
        _driver = d;
        _loading = false;
      });
    } on ForbiddenException catch (_) {
      if (!mounted) return;
      setState(() {
        _forbidden = true;
        _loading = false;
        _error = 'Drivers directory requires elevated role';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 403) {
        setState(() {
          _forbidden = true;
          _loading = false;
          _error = 'Drivers directory requires elevated role';
        });
        return;
      }
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
    final d = _driver;
    return Scaffold(
      appBar: AppBar(title: Text(d?.displayLabel ?? 'Driver')),
      body: _loading
          ? const MpLoading(message: 'Loading driver…')
          : _forbidden
              ? const MpErrorState(
                  title: 'Access restricted',
                  message: 'Drivers directory requires elevated role',
                )
              : _error != null && d == null
                  ? MpErrorState(
                      title: 'Driver unavailable',
                      message: _error,
                      onRetry: _load,
                    )
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        Text(
                          d?.displayLabel ?? widget.driverId,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: MpSpacing.lg),
                        MpCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _row('Email', d?.email ?? '—'),
                              _row('License', d?.licenseNumber ?? '—'),
                              _row('Class', d?.licenseClass ?? '—'),
                              _row('Expiry', d?.licenseExpiry ?? '—'),
                              _row('Phone', d?.phone ?? '—'),
                              _row(
                                'Vehicles',
                                d?.vehicleIds.isEmpty == true
                                    ? 'None'
                                    : d!.vehicleIds.join(', '),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MpSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
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
