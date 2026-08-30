import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/maintenance_models.dart';
import 'providers/maintenance_provider.dart';

class MaintenanceCalendarScreen extends ConsumerStatefulWidget {
  const MaintenanceCalendarScreen({super.key});

  @override
  ConsumerState<MaintenanceCalendarScreen> createState() =>
      _MaintenanceCalendarScreenState();
}

class _MaintenanceCalendarScreenState
    extends ConsumerState<MaintenanceCalendarScreen> {
  DateTime _focused = DateTime.now();
  DateTime? _selected;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(maintenanceCalendarProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Calendar')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text('Failed: $e',
                style: AppTextStyles.body.copyWith(color: AppColors.error)),
          ),
          data: (entries) {
            final byDay = <DateTime, List<MaintenanceCalendarEntry>>{};
            for (final e in entries) {
              if (e.date == null) continue;
              final key = DateTime(e.date!.year, e.date!.month, e.date!.day);
              byDay.putIfAbsent(key, () => []).add(e);
            }
            final selectedKey = _selected == null
                ? null
                : DateTime(_selected!.year, _selected!.month, _selected!.day);
            final dayItems = selectedKey == null
                ? <MaintenanceCalendarEntry>[]
                : (byDay[selectedKey] ?? []);
            return Column(children: [
              TableCalendar<MaintenanceCalendarEntry>(
                firstDay: DateTime.utc(2020, 1, 1),
                lastDay: DateTime.utc(2030, 12, 31),
                focusedDay: _focused,
                selectedDayPredicate: (d) =>
                    _selected != null && isSameDay(_selected, d),
                onDaySelected: (sel, foc) => setState(() {
                  _selected = sel;
                  _focused = foc;
                }),
                eventLoader: (d) {
                  final k = DateTime(d.year, d.month, d.day);
                  return byDay[k] ?? const [];
                },
                calendarStyle: CalendarStyle(
                  todayDecoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.4),
                    shape: BoxShape.circle,
                  ),
                  selectedDecoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                  markerDecoration: const BoxDecoration(
                    color: AppColors.warning,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: dayItems.isEmpty
                    ? Center(
                        child: Text(
                          _selected == null
                              ? 'Select a day to see services'
                              : 'No services on this day',
                          style: AppTextStyles.bodySecondary,
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        itemCount: dayItems.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: AppSpacing.xs),
                        itemBuilder: (_, i) {
                          final e = dayItems[i];
                          return Container(
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            decoration: BoxDecoration(
                              color: AppColors.card.withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(AppRadius.md),
                            ),
                            child: Text(e.title, style: AppTextStyles.body),
                          );
                        },
                      ),
              ),
            ]);
          },
        ),
      ),
    );
  }
}
