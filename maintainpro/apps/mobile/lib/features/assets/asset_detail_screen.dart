import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/asset_models.dart';
import 'data/assets_api_client.dart';

class AssetDetailScreen extends ConsumerStatefulWidget {
  const AssetDetailScreen({super.key, required this.assetId});

  final String assetId;

  @override
  ConsumerState<AssetDetailScreen> createState() => _AssetDetailScreenState();
}

class _AssetDetailScreenState extends ConsumerState<AssetDetailScreen> {
  bool _loading = true;
  String? _error;
  AssetDetail? _asset;
  List<Map<String, dynamic>> _history = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  Future<void> _load() async {
    if (_isOffline && _asset == null) {
      setState(() {
        _loading = false;
        _error = 'Asset detail requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(assetsApiClientProvider);
      final asset = await client.getAsset(widget.assetId);
      List<Map<String, dynamic>> history = const [];
      try {
        history = await client.maintenanceHistory(widget.assetId);
      } catch (_) {
        // History is best-effort.
      }
      if (!mounted) return;
      setState(() {
        _asset = asset;
        _history = history;
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

  @override
  Widget build(BuildContext context) {
    final asset = _asset;
    return Scaffold(
      appBar: AppBar(
        title: Text(asset?.assetTag ?? 'Asset'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const MpLoading(message: 'Loading asset…')
          : _error != null && asset == null
              ? MpErrorState(
                  title: 'Asset unavailable',
                  message: _error,
                  onRetry: _load,
                )
              : asset == null
                  ? const MpEmptyState(title: 'Asset not found')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        children: [
                          Text(
                            asset.name,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: MpSpacing.xs),
                          Wrap(
                            spacing: MpSpacing.sm,
                            runSpacing: MpSpacing.sm,
                            children: [
                              MpStatusChip(label: asset.status),
                              MpStatusChip(label: asset.condition),
                              MpStatusChip(label: asset.category),
                              if (asset.isServiceOverdue)
                                const MpStatusChip(
                                  label: 'Service overdue',
                                  tone: MpStatusTone.error,
                                )
                              else if (asset.isServiceDueSoon)
                                const MpStatusChip(
                                  label: 'Service due soon',
                                  tone: MpStatusTone.warning,
                                ),
                            ],
                          ),
                          const SizedBox(height: MpSpacing.lg),
                          const MpSectionHeader(title: 'Overview'),
                          MpCard(
                            child: Column(
                              children: [
                                _kv('Tag', asset.assetTag),
                                _kv('Location', asset.location ?? '—'),
                                _kv('Department', asset.department ?? '—'),
                                _kv('Owner', asset.ownerName ?? '—'),
                                _kv('Manufacturer', asset.manufacturer ?? '—'),
                                _kv('Model', asset.model ?? '—'),
                                _kv('Serial', asset.serialNumber ?? '—'),
                                if (asset.description != null &&
                                    asset.description!.isNotEmpty)
                                  _kv('Description', asset.description!),
                              ],
                            ),
                          ),
                          const SizedBox(height: MpSpacing.lg),
                          const MpSectionHeader(title: 'Maintenance'),
                          MpCard(
                            child: Column(
                              children: [
                                _kv(
                                  'Last service',
                                  asset.lastServiceDate
                                          ?.toIso8601String()
                                          .split('T')
                                          .first ??
                                      '—',
                                ),
                                _kv(
                                  'Next service',
                                  asset.nextServiceDate
                                          ?.toIso8601String()
                                          .split('T')
                                          .first ??
                                      '—',
                                ),
                                _kv(
                                  'Open work orders',
                                  '${asset.openWorkOrderCount}',
                                ),
                                _kv(
                                  'Work orders (total)',
                                  '${asset.workOrderCount}',
                                ),
                                _kv(
                                  'Maintenance logs',
                                  '${asset.maintenanceLogCount}',
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: MpSpacing.md),
                          MpButton(
                            label: 'Open work orders',
                            icon: Icons.handyman_outlined,
                            onPressed: () => context.push(
                              '/work-orders?assetId=${Uri.encodeComponent(asset.id)}'
                              '&assetTag=${Uri.encodeComponent(asset.assetTag)}',
                            ),
                          ),
                          const SizedBox(height: MpSpacing.lg),
                          const MpSectionHeader(title: 'Meter'),
                          MpCard(
                            child: _kv(
                              'Meter reading',
                              asset.meterReading?.toString() ?? '—',
                            ),
                          ),
                          if (_history.isNotEmpty) ...[
                            const SizedBox(height: MpSpacing.lg),
                            const MpSectionHeader(title: 'History'),
                            MpCard(
                              padding: EdgeInsets.zero,
                              child: Column(
                                children: [
                                  for (var i = 0; i < _history.length; i++) ...[
                                    ListTile(
                                      title: Text(
                                        (_history[i]['title'] ??
                                                _history[i]['type'] ??
                                                _history[i]['status'] ??
                                                'Event')
                                            .toString(),
                                      ),
                                      subtitle: Text(
                                        (_history[i]['completedAt'] ??
                                                _history[i]['createdAt'] ??
                                                '')
                                            .toString(),
                                      ),
                                    ),
                                    if (i < _history.length - 1)
                                      const Divider(height: 1),
                                  ],
                                ],
                              ),
                            ),
                          ],
                          if (_error != null) ...[
                            const SizedBox(height: MpSpacing.md),
                            Text(
                              _error!,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MpSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              k,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(v)),
        ],
      ),
    );
  }
}
