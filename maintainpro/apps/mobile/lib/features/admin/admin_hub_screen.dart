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
                Text(
                  'Administration',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: MpSpacing.sm),
                Text(
                  'Source-backed user, access, tenant, and system controls. '
                  'Critical mutations are online-only.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: MpSpacing.lg),
                const MpSectionHeader(title: 'Access'),
                _tile(context, Icons.people_outline, 'Users',
                    'Access review and activate/deactivate', '/admin/users'),
                _tile(context, Icons.badge_outlined, 'People',
                    'Employee directory', '/admin/people'),
                _tile(context, Icons.security_outlined, 'Roles & permissions',
                    'Server permission catalog', '/admin/roles'),
                _tile(context, Icons.apartment_outlined, 'Tenants',
                    'Tenant overview', '/admin/tenants'),
                _tile(context, Icons.mail_outline, 'Invitations',
                    'Pending invites', '/admin/invitations'),
                const SizedBox(height: MpSpacing.md),
                const MpSectionHeader(title: 'Organization'),
                _tile(context, Icons.account_tree_outlined, 'Departments',
                    'Master data', '/admin/departments'),
                _tile(context, Icons.settings_outlined, 'Settings',
                    'Org / system settings', '/settings'),
                const SizedBox(height: MpSpacing.md),
                const MpSectionHeader(title: 'Governance'),
                _tile(context, Icons.history, 'Audit logs',
                    'Read-only activity trail', '/admin/audit'),
                _tile(context, Icons.monitor_heart_outlined, 'System health',
                    'API readiness dependencies', '/admin/system-health'),
                _tile(context, Icons.bug_report_outlined, 'Diagnostics',
                    'Device / sync diagnostics', '/diagnostics'),
              ],
            ),
    );
  }

  Widget _tile(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
    String route,
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
