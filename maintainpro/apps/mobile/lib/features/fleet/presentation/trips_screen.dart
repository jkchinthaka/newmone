import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/models/trip.dart';
import 'providers/fleet_provider.dart';

class TripsScreen extends ConsumerStatefulWidget {
  const TripsScreen({super.key});

  @override
  ConsumerState<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends ConsumerState<TripsScreen> {
  String? _statusFilter;

  @override
  Widget build(BuildContext context) {
    final trips = ref.watch(allTripsProvider);
    final statuses = const ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

    return Scaffold(
      appBar: AppBar(title: const Text('Trips')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          child: Column(
            children: [
              SizedBox(
                height: 56,
                child: ListView(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                  scrollDirection: Axis.horizontal,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.xs),
                      child: ChoiceChip(
                        label: const Text('All'),
                        selected: _statusFilter == null,
                        onSelected: (_) => setState(() => _statusFilter = null),
                      ),
                    ),
                    ...statuses.map((s) => Padding(
                          padding: const EdgeInsets.only(right: AppSpacing.xs),
                          child: ChoiceChip(
                            label: Text(s.replaceAll('_', ' ')),
                            selected: _statusFilter == s,
                            onSelected: (_) =>
                                setState(() => _statusFilter = s),
                          ),
                        )),
                  ],
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => ref.invalidate(allTripsProvider),
                  child: trips.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (e, _) => Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Text('Failed: $e',
                            style: AppTextStyles.body
                                .copyWith(color: AppColors.error)),
                      ),
                    ),
                    data: (list) {
                      final filtered = _statusFilter == null
                          ? list
                          : list
                              .where((t) => t.status == _statusFilter)
                              .toList();
                      if (filtered.isEmpty) {
                        return ListView(
                          children: const [
                            SizedBox(height: 120),
                            Center(child: Text('No trips found.')),
                          ],
                        );
                      }
                      return ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: AppSpacing.xs),
                        itemBuilder: (_, i) => _TripCard(trip: filtered[i]),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TripCard extends StatelessWidget {
  const _TripCard({required this.trip});
  final Trip trip;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withOpacity(0.7),
          child: InkWell(
            onTap: () => context.push('/fleet/trips/${trip.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(trip.vehicleRegistrationNo ?? trip.vehicleId,
                          style: AppTextStyles.subtitle),
                    ),
                    StatusBadge(status: trip.status, compact: true),
                  ]),
                  const SizedBox(height: AppSpacing.xxs),
                  Text('${trip.startLocation} → ${trip.endLocation}',
                      style: AppTextStyles.bodySecondary,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: AppSpacing.xxs),
                  Row(children: [
                    const Icon(Icons.straighten,
                        size: 14, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text('${trip.distance.toStringAsFixed(1)} km',
                        style: AppTextStyles.caption),
                    const SizedBox(width: AppSpacing.md),
                    if (trip.driver != null) ...[
                      const Icon(Icons.person,
                          size: 14, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(trip.driver!.displayName,
                            style: AppTextStyles.caption,
                            overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ]),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
