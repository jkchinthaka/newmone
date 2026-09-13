import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/compliance_api_client.dart';
import 'data/compliance_models.dart';

class InsuranceClaimsListScreen extends ConsumerStatefulWidget {
  const InsuranceClaimsListScreen({super.key});

  @override
  ConsumerState<InsuranceClaimsListScreen> createState() =>
      _InsuranceClaimsListScreenState();
}

class _InsuranceClaimsListScreenState
    extends ConsumerState<InsuranceClaimsListScreen> {
  bool _loading = true;
  String? _error;
  List<InsuranceClaimSummary> _items = const [];

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
      final items =
          await ref.read(complianceApiClientProvider).listInsuranceClaims();
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
    return Scaffold(
      appBar: AppBar(title: const Text('Insurance claims')),
      body: _loading
          ? const MpLoading(message: 'Loading claims…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No insurance claims')
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
                            onTap: () => context
                                .push('/compliance/insurance-claims/${item.id}'),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(item.claimNumber),
                              subtitle: Text(
                                '${item.status} · ${item.insurerName ?? 'Insurer'} · ${item.claimAmount}',
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
