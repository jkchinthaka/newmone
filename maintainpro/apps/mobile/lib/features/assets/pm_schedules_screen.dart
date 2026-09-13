import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/asset_models.dart';
import 'data/assets_api_client.dart';

/// Read-only PM schedules — Nest calculates due state; phone is not authoritative.
class PmSchedulesScreen extends ConsumerStatefulWidget {
  const PmSchedulesScreen({super.key});

  @override
  ConsumerState<PmSchedulesScreen> createState() => _PmSchedulesScreenState();
}

class _PmSchedulesScreenState extends ConsumerState<PmSchedulesScreen> {
  bool _loading = true;
  String? _error;
  List<MaintenanceScheduleSummary> _all = const [];
  String _filter = 'all'; // all | overdue | upcoming | preventive

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _load() async {
    if (_isOffline && _all.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'PM schedules require connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref.read(assetsApiClientProvider).listSchedules();
      if (!mounted) return;
      setState(() {
        _all = items;
        _loading = false;
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

  List<MaintenanceScheduleSummary> get _visible {
    return _all.where((s) {
      switch (_filter) {
        case 'overdue':
          return s.isOverdue;
        case 'upcoming':
          return s.isUpcoming;
        case 'preventive':
          return s.type.toUpperCase() == 'PREVENTIVE';
        default:
          return true;
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final items = _visible;
    return Scaffold(
      appBar: AppBar(title: const Text('Preventive maintenance')),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: MpSpacing.screenPadding,
                vertical: MpSpacing.sm,
              ),
              children: [
                for (final entry in const [
                  ('all', 'All'),
                  ('overdue', 'Overdue'),
                  ('upcoming', 'Upcoming'),
                  ('preventive', 'PREVENTIVE'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: MpSpacing.sm),
                    child: FilterChip(
                      label: Text(entry.$2),
                      selected: _filter == entry.$1,
                      onSelected: (_) => setState(() => _filter = entry.$1),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading schedules…')
                : _error != null && _all.isEmpty
                    ? MpErrorState(
                        title: 'Schedules unavailable',
                        message: _error,
                        onRetry: _load,
                      )
                    : items.isEmpty
                        ? const MpEmptyState(
                            title: 'No schedules',
                            message:
                                'Nest returned no schedules for this filter.',
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.all(MpSpacing.screenPadding),
                              itemCount: items.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: MpSpacing.sm),
                              itemBuilder: (context, index) {
                                final s = items[index];
                                final title = s.title?.isNotEmpty == true
                                    ? s.title!
                                    : s.type;
                                return MpCard(
                                  child: MpListTile(
                                    title: title,
                                    subtitle: [
                                      s.type,
                                      if (s.assetTag != null) s.assetTag!,
                                      if (s.assetName != null) s.assetName!,
                                      if (s.nextDueDate != null)
                                        'Due ${s.nextDueDate!.toIso8601String().split('T').first}',
                                      if (!s.isActive) 'Inactive',
                                    ].join(' · '),
                                    leading: Icon(
                                      s.isOverdue
                                          ? Icons.warning_amber_outlined
                                          : Icons.event_outlined,
                                    ),
                                    trailing: s.isOverdue
                                        ? const MpStatusChip(
                                            label: 'Overdue',
                                            tone: MpStatusTone.error,
                                          )
                                        : s.isUpcoming
                                            ? const MpStatusChip(
                                                label: 'Upcoming',
                                                tone: MpStatusTone.warning,
                                              )
                                            : null,
                                    onTap: s.assetId == null
                                        ? null
                                        : () => context
                                            .push('/assets/${s.assetId}'),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
