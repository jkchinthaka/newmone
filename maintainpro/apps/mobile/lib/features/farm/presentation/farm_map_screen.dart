import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/dio_client.dart';

class _FarmMapData {
  const _FarmMapData(this.fields, this.animals);
  final List<Map<String, dynamic>> fields;
  final List<Map<String, dynamic>> animals;
}

final _farmMapDataProvider =
    FutureProvider.autoDispose<_FarmMapData>((ref) async {
  final dio = ref.watch(dioProvider);

  Future<List<Map<String, dynamic>>> fetch(String path) async {
    final res = await dio.get<dynamic>(
      path,
      options: Options(validateStatus: (s) => s != null && s < 500),
    );
    final body = res.data;
    final list = body is Map && body['data'] is List
        ? body['data'] as List
        : (body is List ? body : const []);
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  final results = await Future.wait([
    fetch(ApiEndpoints.farmFields),
    fetch(ApiEndpoints.farmLivestockAnimals),
  ]);
  return _FarmMapData(results[0], results[1]);
});

/// Aggregated farm map: shows field markers + livestock GPS markers.
class FarmMapScreen extends ConsumerWidget {
  const FarmMapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_farmMapDataProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Farm map'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(_farmMapDataProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    size: 48, color: AppColors.error),
                const SizedBox(height: AppSpacing.sm),
                Text(e.toString(),
                    textAlign: TextAlign.center, style: AppTextStyles.body),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                    onPressed: () => ref.invalidate(_farmMapDataProvider),
                    child: const Text('Retry')),
              ],
            ),
          ),
        ),
        data: (data) => _FarmMapBody(data: data),
      ),
    );
  }
}

class _FarmMapBody extends StatelessWidget {
  const _FarmMapBody({required this.data});
  final _FarmMapData data;

  double? _latOf(Map<String, dynamic> m) {
    final v = m['latitude'] ?? m['lat'] ?? m['gpsLat'];
    if (v is num) return v.toDouble();
    return double.tryParse('$v');
  }

  double? _lngOf(Map<String, dynamic> m) {
    final v = m['longitude'] ?? m['lng'] ?? m['lon'] ?? m['gpsLng'];
    if (v is num) return v.toDouble();
    return double.tryParse('$v');
  }

  @override
  Widget build(BuildContext context) {
    final markers = <Marker>{};
    LatLng? first;

    for (final f in data.fields) {
      final lat = _latOf(f);
      final lng = _lngOf(f);
      if (lat == null || lng == null) continue;
      final pos = LatLng(lat, lng);
      first ??= pos;
      markers.add(
        Marker(
          markerId: MarkerId('field-${f['id']}'),
          position: pos,
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: InfoWindow(
            title: (f['name'] ?? 'Field').toString(),
            snippet: '${f['areaHectares'] ?? '—'} ha',
          ),
        ),
      );
    }

    for (final a in data.animals) {
      final lat = _latOf(a);
      final lng = _lngOf(a);
      if (lat == null || lng == null) continue;
      final pos = LatLng(lat, lng);
      first ??= pos;
      markers.add(
        Marker(
          markerId: MarkerId('animal-${a['id']}'),
          position: pos,
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
          infoWindow: InfoWindow(
            title: (a['tagId'] ?? a['name'] ?? 'Animal').toString(),
            snippet: (a['species'] ?? '').toString(),
          ),
        ),
      );
    }

    if (markers.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.map_outlined, size: 64),
              const SizedBox(height: AppSpacing.sm),
              Text('No GPS data yet', style: AppTextStyles.title),
              const SizedBox(height: 4),
              Text(
                  'Add coordinates to fields and tag livestock to see them here.',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.body),
            ],
          ),
        ),
      );
    }

    return GoogleMap(
      initialCameraPosition: CameraPosition(
        target: first ?? const LatLng(7.8731, 80.7718), // Sri Lanka centroid
        zoom: 12,
      ),
      markers: markers,
      myLocationButtonEnabled: true,
      compassEnabled: true,
      mapToolbarEnabled: false,
    );
  }
}
