import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/compliance_api_client.dart';
import 'data/compliance_models.dart';

class VehicleDocumentDetailScreen extends ConsumerStatefulWidget {
  const VehicleDocumentDetailScreen({super.key, required this.documentId});

  final String documentId;

  @override
  ConsumerState<VehicleDocumentDetailScreen> createState() =>
      _VehicleDocumentDetailScreenState();
}

class _VehicleDocumentDetailScreenState
    extends ConsumerState<VehicleDocumentDetailScreen> {
  bool _loading = true;
  String? _error;
  VehicleDocumentSummary? _doc;

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
      final doc = await ref
          .read(complianceApiClientProvider)
          .getVehicleDocument(widget.documentId);
      if (!mounted) return;
      setState(() {
        _doc = doc;
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
    final doc = _doc;
    return Scaffold(
      appBar: AppBar(title: const Text('Document')),
      body: _loading
          ? const MpLoading(message: 'Loading document…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : doc == null
                  ? const MpEmptyState(title: 'Document not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        MpCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(doc.documentType,
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              Text('Status: ${doc.status}'),
                              Text(
                                  'Vehicle: ${doc.vehicleRegistration ?? doc.vehicleId ?? '—'}'),
                              Text(
                                  'Expires: ${doc.expiryDate.toLocal().toString().split(' ').first}'),
                              if (doc.documentNumber != null)
                                Text('Number: ${doc.documentNumber}'),
                              if (doc.issuingAuthority != null)
                                Text('Authority: ${doc.issuingAuthority}'),
                              if (doc.notes != null) Text('Notes: ${doc.notes}'),
                            ],
                          ),
                        ),
                        if (doc.vehicleId != null) ...[
                          const SizedBox(height: MpSpacing.md),
                          MpButton(
                            label: 'Open vehicle',
                            icon: Icons.directions_car_outlined,
                            onPressed: () =>
                                context.push('/fleet/vehicles/${doc.vehicleId}'),
                          ),
                        ],
                      ],
                    ),
    );
  }
}
