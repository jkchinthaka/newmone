import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facilities_models.dart';

class UtilityMeterDetailScreen extends ConsumerStatefulWidget {
  const UtilityMeterDetailScreen({super.key, required this.meterId});

  final String meterId;

  @override
  ConsumerState<UtilityMeterDetailScreen> createState() =>
      _UtilityMeterDetailScreenState();
}

class _UtilityMeterDetailScreenState extends ConsumerState<UtilityMeterDetailScreen> {
  bool _loading = true;
  String? _error;
  UtilityMeterSummary? _meter;
  List<MeterReadingSummary> _readings = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(facilitiesApiClientProvider);
      final meter = await client.getMeter(widget.meterId);
      List<MeterReadingSummary> readings = const [];
      try {
        readings = await client.meterReadings(widget.meterId);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _meter = meter;
        _readings = readings;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final meter = _meter;
    return Scaffold(
      appBar: AppBar(title: Text(meter?.meterNumber ?? 'Meter')),
      body: _loading
          ? const MpLoading(message: 'Loading meter…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : meter == null
                  ? const MpEmptyState(title: 'Meter not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        MpCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Type: ${meter.type}'),
                              Text('Location: ${meter.location ?? '—'}'),
                              Text('Unit: ${meter.unit ?? '—'}'),
                            ],
                          ),
                        ),
                        if (_readings.isNotEmpty) ...[
                          const SizedBox(height: MpSpacing.lg),
                          const MpSectionHeader(title: 'Reading history'),
                          ..._readings.take(10).map(
                                (r) => Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: MpSpacing.sm,
                                  ),
                                  child: MpCard(
                                    child: ListTile(
                                      contentPadding: EdgeInsets.zero,
                                      title: Text('${r.readingValue}'),
                                      subtitle: Text(
                                        r.readingDate
                                                ?.toIso8601String()
                                                .split('T')
                                                .first ??
                                            '',
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                        ],
                        const SizedBox(height: MpSpacing.lg),
                        const MpCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(Icons.info_outline),
                            title: Text('Meter entry blocked on mobile'),
                            subtitle: Text(
                              'Reading submission requires server validation and retry semantics — use web utilities.',
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }
}
