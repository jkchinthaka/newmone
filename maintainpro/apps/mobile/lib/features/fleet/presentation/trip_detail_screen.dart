import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/models/gps_ping.dart';
import '../data/models/trip.dart';
import 'providers/fleet_provider.dart';

class TripDetailScreen extends ConsumerWidget {
  const TripDetailScreen({super.key, required this.tripId});
  final String tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsAsync = ref.watch(allTripsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Trip')),
      body: tripsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Text('Failed: $e',
                style: AppTextStyles.body.copyWith(color: AppColors.error))),
        data: (trips) {
          Trip? trip;
          for (final t in trips) {
            if (t.id == tripId) {
              trip = t;
              break;
            }
          }
          if (trip == null) {
            return const Center(child: Text('Trip not found'));
          }
          return _TripBody(trip: trip);
        },
      ),
    );
  }
}

class _TripBody extends ConsumerWidget {
  const _TripBody({required this.trip});
  final Trip trip;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(tripGpsHistoryProvider(trip.vehicleId));
    final dur = trip.duration;
    String fmt(DateTime? d) => d == null
        ? '—'
        : '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

    return Container(
      decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.card.withOpacity(0.7),
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                    child: Text(trip.vehicleRegistrationNo ?? trip.vehicleId,
                        style: AppTextStyles.title),
                  ),
                  StatusBadge(status: trip.status),
                ]),
                const SizedBox(height: AppSpacing.xs),
                Text('${trip.startLocation} → ${trip.endLocation}',
                    style: AppTextStyles.bodySecondary),
                const Divider(height: AppSpacing.lg),
                _row('Driver', trip.driver?.displayName ?? '—'),
                _row('Start mileage',
                    '${trip.startMileage.toStringAsFixed(0)} km'),
                _row('End mileage', '${trip.endMileage.toStringAsFixed(0)} km'),
                _row('Distance', '${trip.distance.toStringAsFixed(1)} km'),
                _row('Started', fmt(trip.startTime)),
                _row('Ended', fmt(trip.endTime)),
                _row('Duration', dur == null ? '—' : '${dur.inMinutes} min'),
                if (trip.purpose != null) _row('Purpose', trip.purpose!),
                if (trip.notes != null) _row('Notes', trip.notes!),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: 320,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              child: historyAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                    child: Text('Could not load track: $e',
                        style: AppTextStyles.body
                            .copyWith(color: AppColors.error))),
                data: (history) {
                  final start = trip.startTime;
                  final end = trip.endTime ?? DateTime.now();
                  final inRange = history
                      .where((p) =>
                          !p.timestamp.isBefore(start) &&
                          !p.timestamp.isAfter(end))
                      .toList()
                    ..sort((a, b) => a.timestamp.compareTo(b.timestamp));
                  return _TripMap(points: inRange);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 130, child: Text(k, style: AppTextStyles.caption)),
            Expanded(child: Text(v, style: AppTextStyles.body)),
          ],
        ),
      );
}

class _TripMap extends StatelessWidget {
  const _TripMap({required this.points});
  final List<GpsPing> points;

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) {
      return Container(
        color: AppColors.card,
        child: const Center(child: Text('No GPS history for this trip')),
      );
    }
    final coords = points.map((p) => LatLng(p.latitude, p.longitude)).toList();
    final start = coords.first;
    final end = coords.last;
    return GoogleMap(
      initialCameraPosition: CameraPosition(target: start, zoom: 13),
      markers: {
        Marker(
            markerId: const MarkerId('start'),
            position: start,
            infoWindow: const InfoWindow(title: 'Start')),
        Marker(
            markerId: const MarkerId('end'),
            position: end,
            infoWindow: const InfoWindow(title: 'End')),
      },
      polylines: {
        Polyline(
            polylineId: const PolylineId('track'),
            points: coords,
            color: AppColors.primaryLight,
            width: 4),
      },
      myLocationButtonEnabled: false,
      mapToolbarEnabled: false,
    );
  }
}
