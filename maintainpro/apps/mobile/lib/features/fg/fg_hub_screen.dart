import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import 'data/fg_api_client.dart';
import 'data/fg_models.dart';
import 'fg_bootstrap_error.dart';

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
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = fgBootstrapUserMessage(e);
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
          const MpPageHeader(
            title: 'Production records',
            subtitle: 'Controlled forms CL18, CL24, CL30, CL39 via Nest FG BFF.',
          ),
          if (!hasFg)
            const MpErrorState(
              title: 'FG access required',
              message:
                  'Your account needs fg.access (or admin) to use FG Digital Recording.',
            )
          else if (_loading)
            const SizedBox(
              height: 280,
              child: MpSkeletonList(count: 2),
            )
          else if (_error != null) ...[
            MpErrorState(
              title: 'FG session unavailable',
              message: _error,
              onRetry: _bootstrap,
            ),
          ] else if (_session?.authenticated == true) ...[
            for (final form in FgFormConfig.all) ...[
              MpCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      form.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: MpSpacing.xs),
                    Text(form.subtitle),
                    if (form.slug == 'cl30' && _session?.expiresAt != null) ...[
                      const SizedBox(height: MpSpacing.sm),
                      Text(
                        'Session expires ${_session!.expiresAt}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: MpSpacing.sm),
              if (_can(perms, role, MpPermissions.fgRecordingCreate))
                MpHubTile(
                  icon: Icons.note_add_outlined,
                  title: 'New ${form.title}',
                  subtitle: form.subtitle,
                  onTap: () => context.push('${form.routePrefix}/new'),
                ),
              const SizedBox(height: MpSpacing.sm),
            ],
            const MpSectionHeader(title: 'Workflow'),
            if (_can(perms, role, MpPermissions.fgRecordingView) ||
                _can(perms, role, MpPermissions.fgRecordingEdit))
              MpHubTile(
                icon: Icons.drafts_outlined,
                title: 'My CL30 drafts',
                subtitle: 'Resume local freezer-truck drafts',
                onTap: () => context.push('/fg/cl30/drafts'),
              ),
            if (_can(perms, role, MpPermissions.fgReviewView))
              MpHubTile(
                icon: Icons.fact_check_outlined,
                title: 'Supervisor reviews',
                subtitle: 'Approve or return submissions',
                onTap: () => context.push('/fg/reviews'),
              ),
            if (_can(perms, role, MpPermissions.fgQaView))
              MpHubTile(
                icon: Icons.verified_outlined,
                title: 'QA',
                subtitle: 'Release, hold, or reject',
                onTap: () => context.push('/fg/qa'),
              ),
            if (_can(perms, role, MpPermissions.fgRecordingView))
              MpHubTile(
                icon: Icons.history,
                title: 'History',
                subtitle: 'Past CL30 records',
                onTap: () => context.push('/fg/history'),
              ),
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
