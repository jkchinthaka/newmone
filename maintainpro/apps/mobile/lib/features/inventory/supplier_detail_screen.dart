import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

class SupplierDetailScreen extends ConsumerStatefulWidget {
  const SupplierDetailScreen({super.key, required this.supplierId});

  final String supplierId;

  @override
  ConsumerState<SupplierDetailScreen> createState() =>
      _SupplierDetailScreenState();
}

class _SupplierDetailScreenState extends ConsumerState<SupplierDetailScreen> {
  bool _loading = true;
  String? _error;
  SupplierSummary? _supplier;

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
      final supplier = await ref
          .read(inventoryApiClientProvider)
          .getSupplier(widget.supplierId);
      if (!mounted) return;
      setState(() {
        _supplier = supplier;
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
    final s = _supplier;
    return Scaffold(
      appBar: AppBar(title: Text(s?.name ?? 'Supplier')),
      body: _loading
          ? const MpLoading(message: 'Loading supplier…')
          : _error != null
              ? MpErrorState(
                  title: 'Supplier unavailable',
                  message: _error,
                  onRetry: _load,
                )
              : s == null
                  ? const MpEmptyState(title: 'Supplier not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        if (s.blacklisted)
                          const Padding(
                            padding: EdgeInsets.only(bottom: MpSpacing.md),
                            child: MpStatusChip(
                              label: 'Blacklisted',
                              tone: MpStatusTone.error,
                            ),
                          ),
                        MpCard(
                          child: Column(
                            children: [
                              _kv('Vendor code', s.vendorCode ?? '—'),
                              _kv('Contact', s.contactName ?? '—'),
                              _kv('Email', s.email ?? '—'),
                              _kv('Phone', s.phone ?? '—'),
                            ],
                          ),
                        ),
                      ],
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
            width: 120,
            child: Text(k, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
          Expanded(child: Text(v)),
        ],
      ),
    );
  }
}
