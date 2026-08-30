import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../design_system/design_system.dart';

/// FG Digital Recording hub — CL30 entry is blocked until `/api/mobile/fg/*` exists.
///
/// Safely probes Nest SSO exchange only (Bearer). Does not call Django recording APIs.
class FgHubScreen extends ConsumerStatefulWidget {
  const FgHubScreen({super.key});

  @override
  ConsumerState<FgHubScreen> createState() => _FgHubScreenState();
}

class _FgHubScreenState extends ConsumerState<FgHubScreen> {
  bool _probing = false;
  String? _ssoStatus;

  Future<void> _probeSso() async {
    setState(() {
      _probing = true;
      _ssoStatus = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post<dynamic>('/auth/fg-sso/exchange', data: {});
      final data = res.data;
      final ok = data is Map && (data['data'] is Map || data['assertion'] != null);
      setState(() {
        _ssoStatus = ok
            ? 'Nest FG SSO exchange succeeded. Django session proxy (mobile BFF) is still required before CL30 mutations.'
            : 'Unexpected SSO response shape.';
      });
    } on ApiException catch (e) {
      setState(() => _ssoStatus = e.message);
    } catch (e) {
      setState(() => _ssoStatus = e.toString());
    } finally {
      if (mounted) setState(() => _probing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authControllerProvider).user?.role ?? '';
    final perms = ref.watch(authControllerProvider).user?.permissions ?? const [];
    final hasFg = perms.contains('fg.access') ||
        role == 'SUPER_ADMIN' ||
        role == 'ADMIN';

    return Scaffold(
      appBar: AppBar(title: const Text('FG Digital Recording')),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          Text(
            'Controlled production records',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: MpSpacing.sm),
          Text(
            'CL30 freezer-truck inspections use Django FG APIs behind Nest SSO. '
            'Native mobile mutations wait on an additive Nest /api/mobile/fg proxy.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: MpSpacing.lg),
          if (!hasFg)
            const MpErrorState(
              title: 'FG access required',
              message: 'Your account needs fg.access (or admin) to use FG Digital Recording.',
            )
          else ...[
            MpCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('NMS/PPU/CL/30', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: MpSpacing.xs),
                  const Text('Inspection Record for Freezer Truck'),
                  const SizedBox(height: MpSpacing.sm),
                  const MpStatusChip(label: 'BLOCKED — mobile FG BFF', tone: MpStatusTone.warning),
                  const SizedBox(height: MpSpacing.md),
                  const Text(
                    'Recorder draft/submit, supervisor review, and QA verification '
                    'remain online-authoritative on Django. See docs/mobile/MOBILE_FG_INTEGRATION.md.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: MpSpacing.md),
            MpButton(
              label: 'Probe Nest FG SSO',
              icon: Icons.vpn_key_outlined,
              variant: MpButtonVariant.outlined,
              isLoading: _probing,
              onPressed: _probing ? null : _probeSso,
            ),
            if (_ssoStatus != null) ...[
              const SizedBox(height: MpSpacing.md),
              Text(_ssoStatus!),
            ],
          ],
        ],
      ),
    );
  }
}
