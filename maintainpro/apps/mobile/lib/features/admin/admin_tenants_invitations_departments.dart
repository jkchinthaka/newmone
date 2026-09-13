import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/admin_api_client.dart';
import 'data/admin_models.dart';

class AdminTenantsScreen extends ConsumerStatefulWidget {
  const AdminTenantsScreen({super.key});

  @override
  ConsumerState<AdminTenantsScreen> createState() => _AdminTenantsScreenState();
}

class _AdminTenantsScreenState extends ConsumerState<AdminTenantsScreen> {
  bool _loading = true;
  String? _error;
  List<TenantRow> _rows = const [];

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
      final rows = await ref.read(adminApiClientProvider).listTenants();
      if (!mounted) return;
      setState(() {
        _rows = rows;
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
      appBar: AppBar(title: const Text('Tenants')),
      body: _loading
          ? const MpLoading(message: 'Loading tenants…')
          : _error != null
              ? MpErrorState(title: 'Could not load tenants', message: _error, onRetry: _load)
              : _rows.isEmpty
                  ? const MpEmptyState(
                      title: 'No tenants',
                      message: 'No tenants returned for this admin context.',
                      icon: Icons.apartment_outlined,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      itemCount: _rows.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: MpSpacing.sm),
                      itemBuilder: (context, i) {
                        final t = _rows[i];
                        return MpCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(t.name),
                            subtitle: Text(
                              [
                                if (t.slug != null) t.slug!,
                                '${t.memberCount} members',
                                t.id,
                              ].join(' · '),
                            ),
                            trailing: MpStatusChip(
                              label: t.isActive ? 'Active' : 'Inactive',
                              tone: t.isActive
                                  ? MpStatusTone.success
                                  : MpStatusTone.warning,
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}

class AdminInvitationsScreen extends ConsumerStatefulWidget {
  const AdminInvitationsScreen({super.key});

  @override
  ConsumerState<AdminInvitationsScreen> createState() =>
      _AdminInvitationsScreenState();
}

class _AdminInvitationsScreenState extends ConsumerState<AdminInvitationsScreen> {
  bool _loading = true;
  String? _error;
  List<InvitationRow> _rows = const [];

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
      final rows = await ref.read(adminApiClientProvider).listInvitations();
      if (!mounted) return;
      setState(() {
        _rows = rows;
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

  Future<void> _invite() async {
    final emailCtrl = TextEditingController();
    final firstCtrl = TextEditingController();
    final lastCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Invite user'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: emailCtrl,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            TextField(
              controller: firstCtrl,
              decoration: const InputDecoration(labelText: 'First name'),
            ),
            TextField(
              controller: lastCtrl,
              decoration: const InputDecoration(labelText: 'Last name'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Send')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final email = emailCtrl.text.trim();
    if (email.isEmpty) return;
    try {
      await ref.read(adminApiClientProvider).createInvitation(
            email: email,
            firstName: firstCtrl.text.trim(),
            lastName: lastCtrl.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invitation created')),
      );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Invitations')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _invite,
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Invite'),
      ),
      body: _loading
          ? const MpLoading(message: 'Loading invitations…')
          : _error != null
              ? MpErrorState(
                  title: 'Could not load invitations',
                  message: _error,
                  onRetry: _load,
                )
              : _rows.isEmpty
                  ? const MpEmptyState(
                      title: 'No invitations',
                      message: 'Create an invitation to provision a user.',
                      icon: Icons.mail_outline,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      itemCount: _rows.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: MpSpacing.sm),
                      itemBuilder: (context, i) {
                        final inv = _rows[i];
                        return MpCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(inv.email),
                            subtitle: Text(
                              [
                                if (inv.inviteeDisplayName != null)
                                  inv.inviteeDisplayName!,
                                if (inv.membershipRole != null)
                                  inv.membershipRole!,
                                if (inv.tenantName != null) inv.tenantName!,
                                if (inv.expiresAt != null)
                                  'Expires ${inv.expiresAt}',
                              ].join(' · '),
                            ),
                            trailing: MpStatusChip(
                              label: inv.status ?? 'PENDING',
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}

class AdminDepartmentsScreen extends ConsumerStatefulWidget {
  const AdminDepartmentsScreen({super.key});

  @override
  ConsumerState<AdminDepartmentsScreen> createState() =>
      _AdminDepartmentsScreenState();
}

class _AdminDepartmentsScreenState extends ConsumerState<AdminDepartmentsScreen> {
  bool _loading = true;
  String? _error;
  List<DepartmentRow> _rows = const [];

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
      final rows = await ref.read(adminApiClientProvider).listDepartments();
      if (!mounted) return;
      setState(() {
        _rows = rows;
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
      appBar: AppBar(title: const Text('Departments')),
      body: _loading
          ? const MpLoading(message: 'Loading departments…')
          : _error != null
              ? MpErrorState(
                  title: 'Could not load departments',
                  message: _error,
                  onRetry: _load,
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(MpSpacing.screenPadding),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: MpSpacing.sm),
                  itemBuilder: (context, i) {
                    final d = _rows[i];
                    return MpCard(
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(d.name),
                        subtitle: Text(
                          [
                            if (d.code != null) d.code!,
                            if (d.parentName != null) 'Parent: ${d.parentName}',
                          ].join(' · '),
                        ),
                        trailing: MpStatusChip(
                          label: d.isActive ? 'Active' : 'Inactive',
                          tone: d.isActive
                              ? MpStatusTone.success
                              : MpStatusTone.warning,
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
