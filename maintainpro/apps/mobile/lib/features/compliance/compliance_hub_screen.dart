import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'compliance_permissions.dart';
import 'data/compliance_api_client.dart';
import 'data/compliance_models.dart';

class ComplianceHubScreen extends ConsumerStatefulWidget {
  const ComplianceHubScreen({super.key});

  @override
  ConsumerState<ComplianceHubScreen> createState() => _ComplianceHubScreenState();
}

class _ComplianceHubScreenState extends ConsumerState<ComplianceHubScreen> {
  bool _loading = true;
  String? _error;
  ComplianceSummary? _summary;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final user = ref.read(authControllerProvider).user;
    if (!CompliancePermissions.canViewCompliance(
      user?.permissions ?? const [],
      user?.role ?? '',
    )) {
      setState(() {
        _loading = false;
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final summary =
          await ref.read(complianceApiClientProvider).complianceSummary();
      if (!mounted) return;
      setState(() {
        _summary = summary;
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
    final perms = user?.permissions ?? const [];
    final role = user?.role ?? '';
    final canCompliance = CompliancePermissions.canViewCompliance(perms, role);

    return Scaffold(
      appBar: AppBar(title: const Text('Compliance')),
      body: !canCompliance
          ? const MpErrorState(
              title: 'Compliance access required',
              message: 'Your role needs compliance.view to browse compliance.',
            )
          : _loading
              ? const MpLoading(message: 'Loading compliance…')
              : _error != null
                  ? MpErrorState(
                      title: 'Could not load',
                      message: _error,
                      onRetry: _load,
                    )
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        if (_summary != null) ...[
                          Text(
                            'Fleet compliance',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: MpSpacing.sm),
                          Wrap(
                            spacing: MpSpacing.sm,
                            runSpacing: MpSpacing.sm,
                            children: [
                              _chip('Compliant', _summary!.compliant),
                              _chip('Attention', _summary!.attention),
                              _chip('Non-compliant', _summary!.nonCompliant),
                            ],
                          ),
                          const SizedBox(height: MpSpacing.lg),
                        ],
                        if (CompliancePermissions.canViewDocuments(perms, role))
                          _link(
                            context,
                            'Expiring documents',
                            'Verified docs expiring within 30 days',
                            '/compliance/documents/expiring',
                            Icons.description_outlined,
                          ),
                        if (CompliancePermissions.canViewAccidents(perms, role))
                          _link(
                            context,
                            'Accidents',
                            'Accident reports and linked work orders',
                            '/compliance/accidents',
                            Icons.car_crash_outlined,
                          ),
                        if (CompliancePermissions.canViewClaims(perms, role))
                          _link(
                            context,
                            'Insurance claims',
                            'Claim status and approvals',
                            '/compliance/insurance-claims',
                            Icons.policy_outlined,
                          ),
                        if (CompliancePermissions.canViewFines(perms, role))
                          _link(
                            context,
                            'Traffic fines',
                            'Fines, payment status, evidence',
                            '/compliance/traffic-fines',
                            Icons.receipt_long_outlined,
                          ),
                        const SizedBox(height: MpSpacing.lg),
                        const MpCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(Icons.block),
                            title: Text('Financial mutations blocked'),
                            subtitle: Text(
                              'Document verify, claim approval, and fine payment require proven idempotency — use web for now.',
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }

  Widget _chip(String label, int count) {
    return Chip(label: Text('$label: $count'));
  }

  Widget _link(
    BuildContext context,
    String title,
    String subtitle,
    String route,
    IconData icon,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MpSpacing.sm),
      child: MpCard(
        onTap: () => context.push(route),
        child: ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon),
          title: Text(title),
          subtitle: Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
        ),
      ),
    );
  }
}
