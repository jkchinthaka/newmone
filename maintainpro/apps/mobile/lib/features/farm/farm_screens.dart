import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/design_system.dart';
import 'data/farm_api_client.dart';

class FarmHubScreen extends ConsumerStatefulWidget {
  const FarmHubScreen({super.key});

  @override
  ConsumerState<FarmHubScreen> createState() => _FarmHubScreenState();
}

class _FarmHubScreenState extends ConsumerState<FarmHubScreen> {
  Map<String, dynamic>? _overview;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final overview = await ref.read(farmApiClientProvider).overview();
      if (!mounted) return;
      setState(() {
        _overview = overview;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Farm'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          const MpPageHeader(
            title: 'Farm operations',
            subtitle:
                'Read-first views backed by Nest /farm APIs. No client-side agronomic calculations.',
          ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: MpSpacing.lg),
              child: MpLoading(message: 'Loading overview…'),
            )
          else if (_overview != null) ...[
            const SizedBox(height: MpSpacing.md),
            Wrap(
              spacing: MpSpacing.sm,
              children: [
                Chip(label: Text('Fields: ${_overview!['fields']}')),
                Chip(label: Text('Crops: ${_overview!['crops']}')),
                Chip(label: Text('Livestock: ${_overview!['livestock']}')),
              ],
            ),
          ],
          const SizedBox(height: MpSpacing.lg),
          _tile(context, 'Fields', '/farm/fields', Icons.landscape_outlined),
          _tile(context, 'Crops', '/farm/crops', Icons.grass_outlined),
          _tile(context, 'Harvest', '/farm/harvest', Icons.agriculture_outlined),
          _tile(context, 'Livestock', '/farm/livestock', Icons.pets_outlined),
          _tile(context, 'Irrigation', '/farm/irrigation', Icons.water_drop_outlined),
          _tile(context, 'Workers', '/farm/workers', Icons.groups_outlined),
          _tile(context, 'Attendance', '/farm/attendance', Icons.event_available_outlined),
          _tile(context, 'Traceability', '/farm/traceability', Icons.qr_code_2_outlined),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, String title, String route, IconData icon) {
    return MpHubTile(
      icon: icon,
      title: title,
      subtitle: 'View $title records',
      onTap: () => context.push(route),
    );
  }
}

typedef FarmListLoader = Future<List<FarmRow>> Function(FarmApiClient client);

class FarmListScreen extends ConsumerStatefulWidget {
  const FarmListScreen({
    super.key,
    required this.title,
    required this.loader,
  });

  final String title;
  final FarmListLoader loader;

  @override
  ConsumerState<FarmListScreen> createState() => _FarmListScreenState();
}

class _FarmListScreenState extends ConsumerState<FarmListScreen> {
  bool _loading = true;
  String? _error;
  List<FarmRow> _rows = const [];

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
      final rows = await widget.loader(ref.read(farmApiClientProvider));
      if (!mounted) return;
      setState(() {
        _rows = rows;
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
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? MpLoading(message: 'Loading ${widget.title.toLowerCase()}…')
          : _error != null
              ? MpErrorState(title: 'Unavailable', message: _error, onRetry: _load)
              : _rows.isEmpty
                  ? MpEmptyState(
                      title: 'No ${widget.title.toLowerCase()}',
                      message: 'No records returned for this tenant.',
                      icon: Icons.agriculture_outlined,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      itemCount: _rows.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: MpSpacing.sm),
                      itemBuilder: (context, i) {
                        final row = _rows[i];
                        return MpCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(row.title),
                            subtitle: row.subtitle?.isNotEmpty == true
                                ? Text(row.subtitle!)
                                : null,
                            trailing: row.status != null
                                ? MpStatusChip(label: row.status!)
                                : null,
                          ),
                        );
                      },
                    ),
    );
  }
}
