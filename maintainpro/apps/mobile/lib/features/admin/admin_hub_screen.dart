import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../design_system/design_system.dart';

/// Full Admin Console hub — SUPER_ADMIN / ADMIN only (UI gate; Nest RBAC authoritative).
class AdminHubScreen extends ConsumerWidget {
  const AdminHubScreen({super.key});

  bool _isAdmin(String role) =>
      role == 'SUPER_ADMIN' || role == 'ADMIN';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(authControllerProvider).user?.role ?? '';
    final allowed = _isAdmin(role.toUpperCase());

    return Scaffold(
      appBar: AppBar(title: const Text('Admin Console')),
      body: !allowed
          ? const MpErrorState(
              title: 'Admin access required',
              message:
                  'Only SUPER_ADMIN and ADMIN can open the Admin Console. Nest RBAC remains authoritative.',
            )
          : ListView(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              children: [
                const MpPageHeader(
                  title: 'Administration',
                  subtitle:
                      'User, access, tenant, and system controls. Critical mutations are online-only.',
                ),
                const MpSectionHeader(title: 'Access'),
                MpHubTile(
                  icon: Icons.people_outline,
                  title: 'Users',
                  subtitle: 'Access review and activate/deactivate',
                  onTap: () => context.push('/admin/users'),
                ),
                MpHubTile(
                  icon: Icons.badge_outlined,
                  title: 'People',
                  subtitle: 'Employee directory',
                  onTap: () => context.push('/admin/people'),
                ),
                MpHubTile(
                  icon: Icons.security_outlined,
                  title: 'Roles & permissions',
                  subtitle: 'Server permission catalog (read-only)',
                  onTap: () => context.push('/admin/roles'),
                ),
                MpHubTile(
                  icon: Icons.apartment_outlined,
                  title: 'Tenants',
                  subtitle: 'Tenant overview',
                  onTap: () => context.push('/admin/tenants'),
                ),
                MpHubTile(
                  icon: Icons.mail_outline,
                  title: 'Invitations',
                  subtitle: 'Pending invites',
                  onTap: () => context.push('/admin/invitations'),
                ),
                const MpSectionHeader(title: 'Organization'),
                MpHubTile(
                  icon: Icons.account_tree_outlined,
                  title: 'Departments',
                  subtitle: 'Master data',
                  onTap: () => context.push('/admin/departments'),
                ),
                MpHubTile(
                  icon: Icons.settings_outlined,
                  title: 'Organization settings',
                  subtitle: 'Org profile & toggles',
                  onTap: () => context.push('/admin/settings'),
                ),
                MpHubTile(
                  icon: Icons.tune_outlined,
                  title: 'App settings',
                  subtitle: 'User preferences',
                  onTap: () => context.push('/settings'),
                ),
                const MpSectionHeader(title: 'Governance'),
                MpHubTile(
                  icon: Icons.history,
                  title: 'Audit logs',
                  subtitle: 'Read-only activity trail',
                  onTap: () => context.push('/admin/audit'),
                ),
                MpHubTile(
                  icon: Icons.monitor_heart_outlined,
                  title: 'System health',
                  subtitle: 'API readiness dependencies',
                  onTap: () => context.push('/admin/system-health'),
                ),
                MpHubTile(
                  icon: Icons.bug_report_outlined,
                  title: 'Diagnostics',
                  subtitle: 'Device / sync diagnostics',
                  onTap: () => context.push('/diagnostics'),
                ),
              ],
            ),
    );
  }
}
