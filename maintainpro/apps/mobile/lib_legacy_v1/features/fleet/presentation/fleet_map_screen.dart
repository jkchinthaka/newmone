import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/gps_ping.dart';
import 'providers/fleet_provider.dart';

class FleetMapScreen extends ConsumerStatefulWidget {
  const FleetMapScreen({super.key});

  @override
  ConsumerState<FleetMapScreen> createState() => _FleetMapScreenState();
}

class _FleetMapScreenState extends ConsumerState<FleetMapScreen> {
  final Map<String, GpsPing> _pings = {};

  @override
  Widget build(BuildContext context) {
    final initialAsync = ref.watch(liveFleetMapProvider);
    ref.listen(liveFleetUpdatesProvider, (_, next) {
      next.whenData((ping) {
        setState(() => _pings[ping.vehicleId] = ping);
      });
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Live fleet map')),
      body: initialAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Text('Failed to load map: $e',
                style: AppTextStyles.body.copyWith(color: AppColors.error)),
          ),
        ),
        data: (initial) {
          for (final p in initial) {
            _pings.putIfAbsent(p.vehicleId, () => p);
          }
          final markers = _pings.values.map(_markerOf).toSet();

          final initialTarget = _pings.values.isNotEmpty
              ? LatLng(
                  _pings.values.first.latitude, _pings.values.first.longitude)
              : const LatLng(0, 0);

          return GoogleMap(
            initialCameraPosition:
                CameraPosition(target: initialTarget, zoom: 11),
            markers: markers,
            myLocationButtonEnabled: false,
            mapToolbarEnabled: false,
          );
        },
      ),
    );
  }

  Marker _markerOf(GpsPing p) {
    return Marker(
      markerId: MarkerId(p.vehicleId),
      position: LatLng(p.latitude, p.longitude),
      rotation: p.heading ?? 0,
      infoWindow: InfoWindow(
        title: p.registrationNo ?? p.vehicleId,
        snippet: p.driverName ??
            (p.intelligence?.offline == true ? 'Offline' : 'Live'),
      ),
      onTap: () => _showVehicleSheet(p),
    );
  }

  void _showVehicleSheet(GpsPing p) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(p.registrationNo ?? p.vehicleId, style: AppTextStyles.title),
              const SizedBox(height: AppSpacing.xs),
              if (p.driverName != null)
                Text(p.driverName!, style: AppTextStyles.bodySecondary),
              const SizedBox(height: AppSpacing.sm),
              if (p.speed != null)
                _kv('Speed', '${p.speed!.toStringAsFixed(0)} km/h'),
              _kv('Updated',
                  '${p.timestamp.hour.toString().padLeft(2, '0')}:${p.timestamp.minute.toString().padLeft(2, '0')}'),
              if (p.intelligence != null) ...[
                _kv('Engine', p.intelligence!.engineOn ? 'On' : 'Off'),
                _kv(
                    'Status',
                    p.intelligence!.offline
                        ? 'Offline'
                        : (p.intelligence!.idle ? 'Idle' : 'Moving')),
                if (p.intelligence!.fuelLevel != null)
                  _kv('Fuel',
                      '${p.intelligence!.fuelLevel!.toStringAsFixed(0)}%'),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          SizedBox(width: 100, child: Text(k, style: AppTextStyles.caption)),
          Expanded(child: Text(v, style: AppTextStyles.body)),
        ]),
      );
}
