import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class ErpStatusScreen extends ConsumerStatefulWidget {
  const ErpStatusScreen({super.key});

  @override
  ConsumerState<ErpStatusScreen> createState() => _ErpStatusScreenState();
}

class _ErpStatusScreenState extends ConsumerState<ErpStatusScreen> {
  bool _loading = true;
  String? _error;
  ErpStatusSummary? _platform;
  Map<String, dynamic> _inventoryReadiness = const {};

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
      final client = ref.read(inventoryApiClientProvider);
      ErpStatusSummary? platform;
      Map<String, dynamic> readiness = const {};
      try {
        platform = await client.erpPlatformStatus();
      } catch (_) {}
      try {
        readiness = await client.erpInventoryReadiness();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _platform = platform;
        _inventoryReadiness = readiness;
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
      appBar: AppBar(title: const Text('ERP status')),
      body: _loading
          ? const MpLoading(message: 'Loading ERP status…')
          : _error != null && _platform == null && _inventoryReadiness.isEmpty
              ? MpErrorState(
                  title: 'ERP status unavailable',
                  message: _error,
                  onRetry: _load,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(MpSpacing.screenPadding),
                    children: [
                      const MpSectionHeader(
                        title: 'Platform ERP',
                        subtitle: 'Read-only — no apply/retry from mobile',
                      ),
                      MpCard(
                        child: _platform == null
                            ? const Text('Platform ERP status not available')
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (_platform!.provider != null)
                                    Text('Provider: ${_platform!.provider}'),
                                  if (_platform!.status != null)
                                    Text('Status: ${_platform!.status}'),
                                  if (_platform!.message != null)
                                    Text(_platform!.message!),
                                ],
                              ),
                      ),
                      const SizedBox(height: MpSpacing.lg),
                      const MpSectionHeader(title: 'Inventory ERP readiness'),
                      MpCard(
                        child: _inventoryReadiness.isEmpty
                            ? const Text('No inventory ERP readiness data')
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: _inventoryReadiness.entries
                                    .map(
                                      (e) => Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: MpSpacing.xs,
                                        ),
                                        child: Text('${e.key}: ${e.value}'),
                                      ),
                                    )
                                    .toList(),
                              ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
