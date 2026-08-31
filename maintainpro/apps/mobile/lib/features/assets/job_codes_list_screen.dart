import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/asset_models.dart';
import 'data/assets_api_client.dart';

/// Browse Nest job codes (read-only on mobile V2).
class JobCodesListScreen extends ConsumerStatefulWidget {
  const JobCodesListScreen({super.key});

  @override
  ConsumerState<JobCodesListScreen> createState() => _JobCodesListScreenState();
}

class _JobCodesListScreenState extends ConsumerState<JobCodesListScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  bool _loading = true;
  String? _error;
  List<JobCodeSummary> _items = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  void _onQuery(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  Future<void> _load() async {
    if (_isOffline && _items.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Job codes require connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref.read(assetsApiClientProvider).listJobCodes(
            q: _search.text,
          );
      if (!mounted) return;
      setState(() {
        _items = items;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Job codes')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            child: TextField(
              controller: _search,
              onChanged: _onQuery,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search code or name',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading job codes…')
                : _error != null && _items.isEmpty
                    ? MpErrorState(
                        title: 'Job codes unavailable',
                        message: _error,
                        onRetry: _load,
                      )
                    : _items.isEmpty
                        ? const MpEmptyState(title: 'No job codes')
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.all(MpSpacing.screenPadding),
                              itemCount: _items.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: MpSpacing.sm),
                              itemBuilder: (context, index) {
                                final j = _items[index];
                                return MpCard(
                                  child: MpListTile(
                                    title: '${j.code} — ${j.name}',
                                    subtitle: [
                                      if (j.category != null) j.category!,
                                      if (j.estimatedHours != null)
                                        '${j.estimatedHours}h',
                                      if (!j.isActive) 'Inactive',
                                    ].join(' · '),
                                    leading: const Icon(Icons.qr_code_2_outlined),
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
