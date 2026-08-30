import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import 'data/fleet_api_client.dart';
import 'data/fleet_models.dart';

/// Drivers directory — Nest restricts to SUPER_ADMIN / ADMIN / ASSET_MANAGER.
class DriversListScreen extends ConsumerStatefulWidget {
  const DriversListScreen({super.key});

  @override
  ConsumerState<DriversListScreen> createState() => _DriversListScreenState();
}

class _DriversListScreenState extends ConsumerState<DriversListScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<DriverSummary> _items = [];
  bool _loading = true;
  String? _error;
  bool _forbidden = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  void _onQueryChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  Future<void> _load() async {
    if (_isOffline) {
      setState(() {
        _loading = false;
        _error = 'Drivers directory requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _forbidden = false;
    });
    try {
      final list = await ref
          .read(fleetApiClientProvider)
          .listDrivers(q: _searchController.text);
      if (!mounted) return;
      setState(() {
        _items = list;
        _loading = false;
      });
    } on ForbiddenException catch (_) {
      if (!mounted) return;
      setState(() {
        _forbidden = true;
        _loading = false;
        _error = 'Drivers directory requires elevated role';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 403) {
        setState(() {
          _forbidden = true;
          _loading = false;
          _error = 'Drivers directory requires elevated role';
        });
        return;
      }
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
      appBar: AppBar(title: const Text('Drivers')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            child: MpTextField(
              controller: _searchController,
              label: 'Search drivers',
              prefixIcon: Icons.search,
              onChanged: _onQueryChanged,
              enabled: !_forbidden,
            ),
          ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading drivers…')
                : _forbidden
                    ? const MpErrorState(
                        title: 'Access restricted',
                        message: 'Drivers directory requires elevated role',
                      )
                    : _error != null
                        ? MpErrorState(
                            title: 'Could not load drivers',
                            message: _error,
                            onRetry: _load,
                          )
                        : _items.isEmpty
                            ? const MpEmptyState(
                                title: 'No drivers',
                                message: 'Try a different search.',
                                icon: Icons.badge_outlined,
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: MpSpacing.screenPadding,
                                ),
                                itemCount: _items.length,
                                itemBuilder: (context, index) {
                                  final d = _items[index];
                                  return Padding(
                                    padding: const EdgeInsets.only(
                                      bottom: MpSpacing.md,
                                    ),
                                    child: MpCard(
                                      onTap: () => context
                                          .push('/fleet/drivers/${d.id}'),
                                      child: ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        leading:
                                            const Icon(Icons.person_outline),
                                        title: Text(d.displayLabel),
                                        subtitle: Text(
                                          [
                                            d.licenseNumber,
                                            d.licenseClass,
                                            d.email,
                                          ]
                                              .whereType<String>()
                                              .where((s) => s.isNotEmpty)
                                              .join(' · '),
                                        ),
                                        trailing:
                                            const Icon(Icons.chevron_right),
                                      ),
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
