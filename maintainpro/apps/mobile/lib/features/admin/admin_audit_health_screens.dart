import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/admin_api_client.dart';
import 'data/admin_models.dart';

class AdminAuditScreen extends ConsumerStatefulWidget {
  const AdminAuditScreen({super.key});

  @override
  ConsumerState<AdminAuditScreen> createState() => _AdminAuditScreenState();
}

class _AdminAuditScreenState extends ConsumerState<AdminAuditScreen> {
  bool _loading = true;
  String? _error;
  List<AuditLogRow> _rows = const [];
  final _moduleCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _moduleCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await ref.read(adminApiClientProvider).listAuditLogs(
            module: _moduleCtrl.text.trim().isEmpty
                ? null
                : _moduleCtrl.text.trim(),
          );
      if (!mounted) return;
      setState(() {
        _rows = rows;
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
      appBar: AppBar(title: const Text('Audit logs')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _moduleCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Module filter',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _load(),
                  ),
                ),
                IconButton(onPressed: _load, icon: const Icon(Icons.search)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MpSpacing.screenPadding),
            child: Text(
              'Audit logs are read-only. Delete/edit controls are not available on mobile.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          const SizedBox(height: MpSpacing.sm),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading audit…')
                : _error != null
                    ? MpErrorState(
                        title: 'Could not load audit logs',
                        message: _error,
                        onRetry: _load,
                      )
                    : _rows.isEmpty
                        ? const MpEmptyState(
                            title: 'No audit events',
                            message: 'No events for this filter.',
                            icon: Icons.history,
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(MpSpacing.screenPadding),
                            itemCount: _rows.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: MpSpacing.sm),
                            itemBuilder: (context, i) {
                              final a = _rows[i];
                              return MpCard(
                                onTap: () => showModalBottomSheet<void>(
                                  context: context,
                                  builder: (_) => Padding(
                                    padding: const EdgeInsets.all(MpSpacing.lg),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(a.action ?? 'Action',
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium),
                                        Text('When: ${a.createdAt}'),
                                        Text('Actor: ${a.actorName ?? a.actorId ?? '—'}'),
                                        Text('Module: ${a.module ?? '—'}'),
                                        Text('Entity: ${a.entity ?? '—'} ${a.entityId ?? ''}'),
                                        if (a.reason != null) Text('Reason: ${a.reason}'),
                                      ],
                                    ),
                                  ),
                                ),
                                child: ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(a.action ?? 'Event'),
                                  subtitle: Text(
                                    [
                                      a.createdAt,
                                      if (a.actorName != null) a.actorName!,
                                      if (a.module != null) a.module!,
                                      if (a.entity != null) a.entity!,
                                    ].join(' · '),
                                  ),
                                  trailing: const Icon(Icons.chevron_right),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class AdminSystemHealthScreen extends ConsumerStatefulWidget {
  const AdminSystemHealthScreen({super.key});

  @override
  ConsumerState<AdminSystemHealthScreen> createState() =>
      _AdminSystemHealthScreenState();
}

class _AdminSystemHealthScreenState
    extends ConsumerState<AdminSystemHealthScreen> {
  bool _loading = true;
  String? _error;
  SystemHealthSnapshot? _readiness;
  Map<String, dynamic>? _public;

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
      final client = ref.read(adminApiClientProvider);
      Map<String, dynamic>? publicHealth;
      SystemHealthSnapshot? readiness;
      try {
        publicHealth = await client.publicHealth();
      } catch (_) {}
      try {
        readiness = await client.systemHealthReadiness();
      } catch (e) {
        if (e is ApiException && e.statusCode == 403) {
          // Non-admin may only see public health.
        } else {
          rethrow;
        }
      }
      if (!mounted) return;
      setState(() {
        _public = publicHealth;
        _readiness = readiness;
        _loading = false;
        if (publicHealth == null && readiness == null) {
          _error = 'No health data available';
        }
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
    final rows = _readiness?.summaryRows ?? const <MapEntry<String, String>>[];
    return Scaffold(
      appBar: AppBar(
        title: const Text('System health'),
        actions: [
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const MpLoading(message: 'Checking health…')
          : _error != null && _readiness == null && _public == null
              ? MpErrorState(title: 'Health unavailable', message: _error, onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.all(MpSpacing.screenPadding),
                  children: [
                    Text(
                      'Connection strings, credentials, and raw env vars are never shown.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: MpSpacing.md),
                    if (_public != null)
                      MpCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('API health',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: MpSpacing.sm),
                            Text('Status: ${_public!['status'] ?? _public!['ok'] ?? 'ok'}'),
                          ],
                        ),
                      ),
                    if (rows.isNotEmpty) ...[
                      const SizedBox(height: MpSpacing.md),
                      const MpSectionHeader(title: 'Readiness'),
                      ...rows.map(
                        (e) => Padding(
                          padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                          child: MpCard(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(e.key),
                              trailing: MpStatusChip(label: e.value),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
    );
  }
}
