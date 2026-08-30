import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import 'data/fg_api_client.dart';
import 'data/fg_models.dart';

/// FG Digital Recording hub — bootstraps Nest `/mobile/fg` session, then
/// surfaces CL30 / review / QA / history actions gated by permission keys.
///
/// UI permission hiding is UX only; Nest RBAC remains authoritative.
class FgHubScreen extends ConsumerStatefulWidget {
  const FgHubScreen({super.key});

  @override
  ConsumerState<FgHubScreen> createState() => _FgHubScreenState();
}

class _FgHubScreenState extends ConsumerState<FgHubScreen> {
  bool _loading = true;
  String? _error;
  FgSessionStatus? _session;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(fgApiClientProvider);
      final status = await client.bootstrap();
      if (!mounted) return;
      setState(() {
        _session = status;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
        _session = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
        _session = null;
      });
    }
  }

  bool _isAdmin(String role) => role == 'SUPER_ADMIN' || role == 'ADMIN';

  bool _can(List<String> perms, String role, String permission) {
    if (_isAdmin(role)) return true;
    return MpPermissions.has(perms, permission);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final role = user?.role ?? '';
    final perms = user?.permissions ?? const [];
    final hasFg = _can(perms, role, MpPermissions.fgAccess);

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
            'CL30 freezer-truck inspections via Nest mobile FG BFF '
            '(Bearer only — no Django cookies on device).',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: MpSpacing.lg),
          if (!hasFg)
            const MpErrorState(
              title: 'FG access required',
              message:
                  'Your account needs fg.access (or admin) to use FG Digital Recording.',
            )
          else if (_loading)
            const MpLoading(message: 'Preparing FG session…')
          else if (_error != null) ...[
            MpErrorState(
              title: 'FG session unavailable',
              message: _error,
              onRetry: _bootstrap,
            ),
          ] else if (_session?.authenticated == true) ...[
            MpCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    kCl30FormCode,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: MpSpacing.xs),
                  const Text('Inspection Record for Freezer Truck'),
                  const SizedBox(height: MpSpacing.sm),
                  const MpStatusChip(
                    label: 'Session ready',
                    tone: MpStatusTone.success,
                  ),
                  if (_session?.expiresAt != null) ...[
                    const SizedBox(height: MpSpacing.sm),
                    Text(
                      'Expires ${_session!.expiresAt}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: MpSpacing.md),
            const MpSectionHeader(title: 'Actions'),
            if (_can(perms, role, MpPermissions.fgRecordingCreate))
              MpCard(
                onTap: () => context.push('/fg/cl30/new'),
                child: const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.local_shipping_outlined),
                  title: Text('New CL30'),
                  subtitle: Text('Open a freezer-truck inspection'),
                  trailing: Icon(Icons.chevron_right),
                ),
              ),
            if (_can(perms, role, MpPermissions.fgRecordingView) ||
                _can(perms, role, MpPermissions.fgRecordingEdit)) ...[
              const SizedBox(height: MpSpacing.sm),
              MpCard(
                onTap: () => context.push('/fg/cl30/drafts'),
                child: const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.drafts_outlined),
                  title: Text('My drafts'),
                  subtitle: Text('Resume local CL30 drafts'),
                  trailing: Icon(Icons.chevron_right),
                ),
              ),
            ],
            if (_can(perms, role, MpPermissions.fgReviewView)) ...[
              const SizedBox(height: MpSpacing.sm),
              MpCard(
                onTap: () => context.push('/fg/reviews'),
                child: const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.fact_check_outlined),
                  title: Text('Supervisor reviews'),
                  subtitle: Text('Approve or return submissions'),
                  trailing: Icon(Icons.chevron_right),
                ),
              ),
            ],
            if (_can(perms, role, MpPermissions.fgQaView)) ...[
              const SizedBox(height: MpSpacing.sm),
              MpCard(
                onTap: () => context.push('/fg/qa'),
                child: const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.verified_outlined),
                  title: Text('QA'),
                  subtitle: Text('Release, hold, or reject'),
                  trailing: Icon(Icons.chevron_right),
                ),
              ),
            ],
            if (_can(perms, role, MpPermissions.fgRecordingView)) ...[
              const SizedBox(height: MpSpacing.sm),
              MpCard(
                onTap: () => context.push('/fg/history'),
                child: const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.history),
                  title: Text('History'),
                  subtitle: Text('Past CL30 records'),
                  trailing: Icon(Icons.chevron_right),
                ),
              ),
            ],
          ] else
            MpErrorState(
              title: 'Not authenticated to FG',
              message: 'Bootstrap did not return an authenticated session.',
              onRetry: _bootstrap,
            ),
        ],
      ),
    );
  }
}
