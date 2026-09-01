import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/reports_api_client.dart';
import 'data/reports_models.dart';

class ReportsDashboardScreen extends ConsumerStatefulWidget {
  const ReportsDashboardScreen({super.key});

  @override
  ConsumerState<ReportsDashboardScreen> createState() =>
      _ReportsDashboardScreenState();
}

class _ReportsDashboardScreenState
    extends ConsumerState<ReportsDashboardScreen> {
  bool _loading = true;
  String? _error;
  ReportDashboard? _dash;

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
      final dash = await ref.read(reportsApiClientProvider).dashboard();
      if (!mounted) return;
      setState(() {
        _dash = dash;
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
    final cards = [
      ...?_dash?.summaryCards,
      ...?_dash?.cards,
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Management dashboard'),
        actions: [
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const MpLoading(message: 'Loading KPIs…')
          : _error != null
              ? MpErrorState(title: 'Dashboard unavailable', message: _error, onRetry: _load)
              : cards.isEmpty
                  ? const MpEmptyState(
                      title: 'No KPIs',
                      message: 'Server returned an empty dashboard for this role.',
                      icon: Icons.dashboard_outlined,
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: MpSpacing.sm,
                        crossAxisSpacing: MpSpacing.sm,
                        childAspectRatio: 1.35,
                      ),
                      itemCount: cards.length,
                      itemBuilder: (context, i) {
                        final c = cards[i];
                        return MpCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                c.label,
                                style: Theme.of(context).textTheme.labelLarge,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const Spacer(),
                              Text(
                                c.value,
                                style: Theme.of(context).textTheme.headlineSmall,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (c.subLabel != null)
                                Text(
                                  c.subLabel!,
                                  style: Theme.of(context).textTheme.bodySmall,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}

class ReportModuleScreen extends ConsumerStatefulWidget {
  const ReportModuleScreen({super.key, required this.module});

  final String module;

  @override
  ConsumerState<ReportModuleScreen> createState() => _ReportModuleScreenState();
}

class _ReportModuleScreenState extends ConsumerState<ReportModuleScreen> {
  bool _loading = true;
  String? _error;
  ReportModulePage? _page;

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
      final page = await ref
          .read(reportsApiClientProvider)
          .moduleReport(widget.module);
      if (!mounted) return;
      setState(() {
        _page = page;
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
    final title = kReportModules[widget.module] ?? widget.module;
    final page = _page;
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const MpLoading(message: 'Loading report…')
          : _error != null
              ? MpErrorState(title: 'Report unavailable', message: _error, onRetry: _load)
              : page == null || (page.rows.isEmpty && page.kpis.isEmpty)
                  ? const MpEmptyState(
                      title: 'Empty report',
                      message: 'No rows for the current filters.',
                      icon: Icons.table_chart_outlined,
                    )
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        if (page.kpis.isNotEmpty) ...[
                          Wrap(
                            spacing: MpSpacing.sm,
                            runSpacing: MpSpacing.sm,
                            children: page.kpis
                                .map(
                                  (k) => Chip(
                                    label: Text('${k.label}: ${k.value}'),
                                  ),
                                )
                                .toList(),
                          ),
                          const SizedBox(height: MpSpacing.md),
                        ],
                        Text(
                          'Showing ${page.rows.length} of ${page.total} (server page ${page.page})',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: MpSpacing.sm),
                        ...page.rows.map((row) {
                          final titleKey = page.columns.isNotEmpty
                              ? page.columns.first
                              : row.keys.first;
                          final subtitle = page.columns
                              .skip(1)
                              .take(3)
                              .map((c) => '${c}: ${row[c] ?? '—'}')
                              .join(' · ');
                          return Padding(
                            padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                            child: MpCard(
                              child: ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text((row[titleKey] ?? titleKey).toString()),
                                subtitle: Text(
                                  subtitle.isEmpty
                                      ? row.entries
                                          .take(4)
                                          .map((e) => '${e.key}: ${e.value}')
                                          .join(' · ')
                                      : subtitle,
                                ),
                              ),
                            ),
                          );
                        }),
                      ],
                    ),
    );
  }
}

class ManagementIntelligenceScreen extends ConsumerStatefulWidget {
  const ManagementIntelligenceScreen({super.key});

  @override
  ConsumerState<ManagementIntelligenceScreen> createState() =>
      _ManagementIntelligenceScreenState();
}

class _ManagementIntelligenceScreenState
    extends ConsumerState<ManagementIntelligenceScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _data;

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
      final data =
          await ref.read(reportsApiClientProvider).managementSummary();
      if (!mounted) return;
      setState(() {
        _data = data;
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
    final data = _data ?? {};
    final entries = data.entries
        .where((e) => e.value is! Map && e.value is! List)
        .take(24)
        .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Management intelligence')),
      body: _loading
          ? const MpLoading(message: 'Loading summary…')
          : _error != null
              ? MpErrorState(
                  title: 'Unavailable',
                  message: _error,
                  onRetry: _load,
                )
              : ListView(
                  padding: const EdgeInsets.all(MpSpacing.screenPadding),
                  children: [
                    Text(
                      'Server profitability / cost summary. Nested charts remain on Web.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: MpSpacing.md),
                    ...entries.map(
                      (e) => Padding(
                        padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                        child: MpCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(e.key),
                            trailing: Text(e.value?.toString() ?? '—'),
                          ),
                        ),
                      ),
                    ),
                    if (entries.isEmpty)
                      const MpEmptyState(
                        title: 'No scalar summary fields',
                        message:
                            'Response may be nested. Open Web Management Intelligence for full charts.',
                        icon: Icons.insights_outlined,
                      ),
                  ],
                ),
    );
  }
}

class MaintenanceExceptionsScreen extends ConsumerStatefulWidget {
  const MaintenanceExceptionsScreen({super.key});

  @override
  ConsumerState<MaintenanceExceptionsScreen> createState() =>
      _MaintenanceExceptionsScreenState();
}

class _MaintenanceExceptionsScreenState
    extends ConsumerState<MaintenanceExceptionsScreen> {
  bool _loading = true;
  String? _error;
  List<MaintenanceExceptionCard> _cards = const [];

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
      final cards =
          await ref.read(reportsApiClientProvider).maintenanceExceptions();
      if (!mounted) return;
      setState(() {
        _cards = cards;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Maintenance exceptions')),
      body: _loading
          ? const MpLoading(message: 'Loading exceptions…')
          : _error != null
              ? MpErrorState(title: 'Unavailable', message: _error, onRetry: _load)
              : _cards.isEmpty
                  ? const MpEmptyState(
                      title: 'No exceptions',
                      message: 'Server returned no exception cards.',
                      icon: Icons.warning_amber_outlined,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      itemCount: _cards.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: MpSpacing.sm),
                      itemBuilder: (context, i) {
                        final c = _cards[i];
                        return MpCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(c.label),
                            subtitle: Text(c.type),
                            trailing: Text(
                              '${c.count}',
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}

class SimpleMapReportScreen extends ConsumerStatefulWidget {
  const SimpleMapReportScreen({
    super.key,
    required this.title,
    required this.loader,
  });

  final String title;
  final Future<Map<String, dynamic>> Function(ReportsApiClient client) loader;

  @override
  ConsumerState<SimpleMapReportScreen> createState() =>
      _SimpleMapReportScreenState();
}

class _SimpleMapReportScreenState extends ConsumerState<SimpleMapReportScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _data = const {};

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
      final data = await widget.loader(ref.read(reportsApiClientProvider));
      if (!mounted) return;
      setState(() {
        _data = data;
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
    final entries = _data.entries
        .where((e) => e.value is! Map && e.value is! List)
        .toList();
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _loading
          ? const MpLoading(message: 'Loading…')
          : _error != null
              ? MpErrorState(title: 'Unavailable', message: _error, onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.all(MpSpacing.screenPadding),
                  children: entries
                      .map(
                        (e) => Padding(
                          padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                          child: MpCard(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(e.key),
                              trailing: Text('${e.value}'),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
    );
  }
}
