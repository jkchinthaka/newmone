import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/admin_api_client.dart';
import 'data/admin_models.dart';
import 'admin_settings_people_extras.dart';

class AdminUsersScreen extends ConsumerStatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  ConsumerState<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends ConsumerState<AdminUsersScreen> {
  bool _loading = true;
  String? _error;
  List<AdminUserRow> _users = const [];
  String _q = '';

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
      final users = await ref.read(adminApiClientProvider).listAdminUsers();
      if (!mounted) return;
      setState(() {
        _users = users;
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

  List<AdminUserRow> get _filtered {
    final q = _q.trim().toLowerCase();
    if (q.isEmpty) return _users;
    return _users
        .where((u) =>
            u.displayName.toLowerCase().contains(q) ||
            u.email.toLowerCase().contains(q) ||
            (u.roleName ?? '').toLowerCase().contains(q))
        .toList();
  }

  Future<void> _confirmStatus(AdminUserRow user) async {
    final next = !user.isActive;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(next ? 'Activate user?' : 'Deactivate user?'),
        content: Text(
          '${user.displayName} (${user.email})\n\n'
          'This is an online-only critical Admin action and is audited on the server.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(adminApiClientProvider).updateAdminUserStatus(
            user.id,
            isActive: next,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(next ? 'User activated' : 'User deactivated')),
      );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Users'),
        actions: [
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      floatingActionButton: adminCanManageUsers(ref)
          ? FloatingActionButton.extended(
              onPressed: () => showAdminUserEditor(context, ref, onSaved: _load),
              icon: const Icon(Icons.person_add),
              label: const Text('Create'),
            )
          : null,
      body: _loading
          ? const MpLoading(message: 'Loading users…')
          : _error != null
              ? MpErrorState(title: 'Could not load users', message: _error, onRetry: _load)
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      child: TextField(
                        decoration: const InputDecoration(
                          labelText: 'Search',
                          prefixIcon: Icon(Icons.search),
                          border: OutlineInputBorder(),
                        ),
                        onChanged: (v) => setState(() => _q = v),
                      ),
                    ),
                    Expanded(
                      child: rows.isEmpty
                          ? const MpEmptyState(
                              title: 'No users',
                              message: 'No users match this search.',
                              icon: Icons.people_outline,
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(
                                MpSpacing.screenPadding,
                                0,
                                MpSpacing.screenPadding,
                                MpSpacing.screenPadding,
                              ),
                              itemCount: rows.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: MpSpacing.sm),
                              itemBuilder: (context, i) {
                                final u = rows[i];
                                return MpCard(
                                  onTap: () => context.push('/admin/users/${u.id}', extra: u),
                                  child: ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(u.displayName),
                                    subtitle: Text(
                                      [
                                        u.email,
                                        if (u.roleName != null) u.roleName!,
                                        if (u.tenantName != null) u.tenantName!,
                                      ].join(' · '),
                                    ),
                                    trailing: PopupMenuButton<String>(
                                      onSelected: (v) {
                                        if (v == 'toggle') _confirmStatus(u);
                                      },
                                      itemBuilder: (_) => [
                                        PopupMenuItem(
                                          value: 'toggle',
                                          child: Text(
                                            u.isActive ? 'Deactivate' : 'Activate',
                                          ),
                                        ),
                                      ],
                                    ),
                                    leading: MpStatusChip(
                                      label: u.isActive ? 'Active' : 'Inactive',
                                      tone: u.isActive
                                          ? MpStatusTone.success
                                          : MpStatusTone.warning,
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}

class AdminUserDetailScreen extends ConsumerWidget {
  const AdminUserDetailScreen({super.key, required this.user});

  final AdminUserRow user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: Text(user.displayName),
        actions: [
          if (adminCanManageUsers(ref))
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () => showAdminUserEditor(
                context,
                ref,
                existing: user,
                onSaved: () {},
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          MpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _kv('Email', user.email),
                _kv('Role', user.roleName ?? '—'),
                _kv('Tenant', user.tenantName ?? user.tenantId ?? '—'),
                _kv('Status', user.isActive ? 'Active' : 'Inactive'),
                _kv('Last login', user.lastLogin ?? '—'),
                _kv('User ID', user.id),
              ],
            ),
          ),
          const SizedBox(height: MpSpacing.md),
          Text(
            'Password hashes and auth secrets are never shown. '
            'Invite / reset flows use secure Nest endpoints only.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: MpSpacing.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 110, child: Text(k, style: const TextStyle(fontWeight: FontWeight.w600))),
            Expanded(child: Text(v)),
          ],
        ),
      );
}
