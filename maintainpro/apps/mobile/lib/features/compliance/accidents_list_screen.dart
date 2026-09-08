import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'compliance_permissions.dart';
import 'data/compliance_api_client.dart';
import 'data/compliance_models.dart';

class AccidentsListScreen extends ConsumerStatefulWidget {
  const AccidentsListScreen({super.key, this.vehicleId});

  final String? vehicleId;

  @override
  ConsumerState<AccidentsListScreen> createState() => _AccidentsListScreenState();
}

class _AccidentsListScreenState extends ConsumerState<AccidentsListScreen> {
  bool _loading = true;
  String? _error;
  List<AccidentSummary> _items = const [];

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
      final items = await ref
          .read(complianceApiClientProvider)
          .listAccidents(vehicleId: widget.vehicleId);
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final canReport = CompliancePermissions.canReportAccident(
      user?.permissions ?? const [],
      user?.role ?? '',
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Accidents')),
      floatingActionButton: canReport
          ? FloatingActionButton.extended(
              onPressed: () => context.push(
                '/compliance/accidents/report${widget.vehicleId != null ? '?vehicleId=${widget.vehicleId}' : ''}',
              ),
              icon: const Icon(Icons.add),
              label: const Text('Report'),
            )
          : null,
      body: _loading
          ? const MpLoading(message: 'Loading accidents…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No accident reports')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          return MpCard(
                            onTap: () =>
                                context.push('/compliance/accidents/${item.id}'),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(item.reportNumber),
                              subtitle: Text(
                                '${item.severity} · ${item.status} · ${item.location}',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
