import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import 'data/admin_api_client.dart';
import 'data/admin_models.dart';

class AdminOrgSettingsScreen extends ConsumerStatefulWidget {
  const AdminOrgSettingsScreen({super.key});

  @override
  ConsumerState<AdminOrgSettingsScreen> createState() =>
      _AdminOrgSettingsScreenState();
}

class _AdminOrgSettingsScreenState extends ConsumerState<AdminOrgSettingsScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _org = const {};
  Map<String, dynamic> _toggles = const {};

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
      final client = ref.read(adminApiClientProvider);
      final org = await client.getOrganizationSettings();
      Map<String, dynamic> toggles = const {};
      try {
        toggles = await client.getFeatureToggles();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _org = org;
        _toggles = toggles;
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
      appBar: AppBar(
        title: const Text('Organization settings'),
        actions: [
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const MpLoading(message: 'Loading settings…')
          : _error != null
              ? MpErrorState(title: 'Settings unavailable', message: _error, onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.all(MpSpacing.screenPadding),
                  children: [
                    const MpSectionHeader(title: 'Organization profile'),
                    MpCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _kv('Company', (_org['companyName'] ?? '—').toString()),
                          _kv('Slug', (_org['slug'] ?? '—').toString()),
                          _kv('Timezone', (_org['timezone'] ?? '—').toString()),
                          _kv('Currency', (_org['currency'] ?? '—').toString()),
                        ],
                      ),
                    ),
                    const SizedBox(height: MpSpacing.md),
                    const MpSectionHeader(title: 'Feature toggles'),
                    if (_toggles.isEmpty)
                      const MpEmptyState(
                        title: 'No toggles',
                        message: 'Server returned no feature toggles for this tenant.',
                      )
                    else
                      ..._toggles.entries.map(
                        (e) => Padding(
                          padding: const EdgeInsets.only(bottom: MpSpacing.sm),
                          child: MpCard(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(e.key),
                              trailing: MpStatusChip(
                                label: e.value == true ? 'On' : 'Off',
                                tone: e.value == true
                                    ? MpStatusTone.success
                                    : MpStatusTone.neutral,
                              ),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: MpSpacing.md),
                    Text(
                      'Secrets, connection strings, and raw env values are never shown on mobile.',
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
            SizedBox(
              width: 100,
              child: Text(k, style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Expanded(child: Text(v)),
          ],
        ),
      );
}

class AdminPersonDetailScreen extends ConsumerStatefulWidget {
  const AdminPersonDetailScreen({super.key, required this.personId});

  final String personId;

  @override
  ConsumerState<AdminPersonDetailScreen> createState() =>
      _AdminPersonDetailScreenState();
}

class _AdminPersonDetailScreenState extends ConsumerState<AdminPersonDetailScreen> {
  bool _loading = true;
  String? _error;
  PersonRow? _person;

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
      final person =
          await ref.read(adminApiClientProvider).getPerson(widget.personId);
      if (!mounted) return;
      setState(() {
        _person = person;
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

  Future<void> _toggleActive() async {
    final p = _person;
    if (p == null) return;
    final next = !p.active;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(next ? 'Reactivate person?' : 'Deactivate person?'),
        content: Text(
          '${p.fullName}\n\nOnline-only admin action audited on server.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      if (next) {
        await ref.read(adminApiClientProvider).reactivatePerson(p.id);
      } else {
        await ref.read(adminApiClientProvider).deactivatePerson(p.id);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(next ? 'Person reactivated' : 'Person deactivated')),
      );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _person;
    return Scaffold(
      appBar: AppBar(title: Text(p?.fullName ?? 'Person')),
      body: _loading
          ? const MpLoading(message: 'Loading person…')
          : _error != null
              ? MpErrorState(title: 'Person unavailable', message: _error, onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.all(MpSpacing.screenPadding),
                  children: [
                    MpCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _kv('Email', p?.email ?? '—'),
                          _kv('Phone', p?.phone ?? '—'),
                          _kv('Designation', p?.designation ?? '—'),
                          _kv('Department', p?.departmentName ?? '—'),
                          _kv('Role', p?.roleName ?? '—'),
                          _kv('Login', p?.canLogin == true ? 'Enabled' : 'Disabled'),
                          _kv('Linked user', p?.linkedUserId ?? '—'),
                          _kv('Invite status', p?.inviteStatus ?? '—'),
                          _kv('Status', p?.active == true ? 'Active' : 'Inactive'),
                        ],
                      ),
                    ),
                    const SizedBox(height: MpSpacing.md),
                    MpButton(
                      label: p?.active == true ? 'Deactivate' : 'Reactivate',
                      variant: MpButtonVariant.outlined,
                      expand: false,
                      onPressed: _toggleActive,
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
            SizedBox(
              width: 110,
              child: Text(k, style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Expanded(child: Text(v)),
          ],
        ),
      );
}

Future<void> showAdminUserEditor(
  BuildContext context,
  WidgetRef ref, {
  AdminUserRow? existing,
  required VoidCallback onSaved,
}) async {
  final client = ref.read(adminApiClientProvider);
  List<RoleRow> roles = const [];
  try {
    roles = await client.listRoles();
  } catch (_) {}

  final emailCtrl = TextEditingController(text: existing?.email ?? '');
  final firstCtrl = TextEditingController();
  final lastCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();
  String? roleId = roles
      .cast<RoleRow?>()
      .firstWhere(
        (r) => r?.name == existing?.roleName,
        orElse: () => roles.isNotEmpty ? roles.first : null,
      )
      ?.id;

  if (!context.mounted) return;
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(existing == null ? 'Create user' : 'Edit user'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (existing == null)
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
            TextField(
              controller: phoneCtrl,
              decoration: const InputDecoration(labelText: 'Phone'),
            ),
            if (existing == null)
              TextField(
                controller: passwordCtrl,
                decoration: const InputDecoration(labelText: 'Password (min 8)'),
                obscureText: true,
              ),
            if (roles.isNotEmpty)
              DropdownButtonFormField<String>(
                value: roleId,
                decoration: const InputDecoration(labelText: 'Role'),
                items: roles
                    .map(
                      (r) => DropdownMenuItem(value: r.id, child: Text(r.name)),
                    )
                    .toList(),
                onChanged: (v) => roleId = v,
              ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(
          onPressed: () async {
            try {
              if (existing == null) {
                if (roleId == null || passwordCtrl.text.length < 8) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Role and password (8+) required')),
                  );
                  return;
                }
                await client.createUser(
                  email: emailCtrl.text,
                  password: passwordCtrl.text,
                  firstName: firstCtrl.text,
                  lastName: lastCtrl.text,
                  roleId: roleId!,
                  phone: phoneCtrl.text,
                );
              } else {
                await client.updateUser(
                  existing.id,
                  firstName: firstCtrl.text.isNotEmpty ? firstCtrl.text : null,
                  lastName: lastCtrl.text.isNotEmpty ? lastCtrl.text : null,
                  phone: phoneCtrl.text,
                  roleId: roleId,
                );
              }
              if (ctx.mounted) Navigator.pop(ctx);
              onSaved();
            } on ApiException catch (e) {
              if (ctx.mounted) {
                ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(e.message)));
              }
            }
          },
          child: const Text('Save'),
        ),
      ],
    ),
  );
}

bool adminCanManageUsers(WidgetRef ref) {
  final user = ref.read(authControllerProvider).user;
  if (user == null) return false;
  final role = user.role.toUpperCase();
  if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
  return MpPermissions.has(user.permissions, 'users.create') ||
      MpPermissions.has(user.permissions, 'users.edit');
}

bool adminIsSuperAdmin(WidgetRef ref) {
  final role = ref.read(authControllerProvider).user?.role.toUpperCase();
  return role == 'SUPER_ADMIN';
}

bool _adminPasswordMeetsPolicy(String password) {
  return RegExp(r'^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$').hasMatch(password);
}

Future<void> showAdminSetPasswordSheet(
  BuildContext context,
  WidgetRef ref, {
  required AdminUserRow user,
}) async {
  final passwordCtrl = TextEditingController();
  final confirmCtrl = TextEditingController();
  var obscure = true;
  var saving = false;
  String? error;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setSheetState) {
          Future<void> submit() async {
            final password = passwordCtrl.text;
            final confirm = confirmCtrl.text;
            if (password.length < 8) {
              setSheetState(() => error = 'Password must be at least 8 characters');
              return;
            }
            if (!_adminPasswordMeetsPolicy(password)) {
              setSheetState(
                () => error =
                    'Use 8+ chars with uppercase, number, and special character',
              );
              return;
            }
            if (password != confirm) {
              setSheetState(() => error = 'Passwords do not match');
              return;
            }
            setSheetState(() {
              saving = true;
              error = null;
            });
            try {
              await ref.read(adminApiClientProvider).setAdminUserPassword(
                    user.id,
                    newPassword: password,
                  );
              if (!ctx.mounted) return;
              Navigator.pop(ctx);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Password updated for ${user.displayName}')),
              );
            } on ApiException catch (e) {
              setSheetState(() {
                saving = false;
                error = e.message;
              });
            }
          }

          return Padding(
            padding: EdgeInsets.fromLTRB(
              MpSpacing.screenPadding,
              0,
              MpSpacing.screenPadding,
              MediaQuery.viewInsetsOf(ctx).bottom + MpSpacing.screenPadding,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Set password',
                  style: Theme.of(ctx).textTheme.titleLarge,
                ),
                const SizedBox(height: MpSpacing.xs),
                Text(
                  '${user.displayName} · ${user.email}\n'
                  'Online only. Existing passwords are never shown.',
                  style: Theme.of(ctx).textTheme.bodySmall,
                ),
                const SizedBox(height: MpSpacing.md),
                TextField(
                  controller: passwordCtrl,
                  obscureText: obscure,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: InputDecoration(
                    labelText: 'New password',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(obscure ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setSheetState(() => obscure = !obscure),
                    ),
                  ),
                  enabled: !saving,
                ),
                const SizedBox(height: MpSpacing.sm),
                TextField(
                  controller: confirmCtrl,
                  obscureText: obscure,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: const InputDecoration(
                    labelText: 'Confirm password',
                    border: OutlineInputBorder(),
                  ),
                  enabled: !saving,
                  onSubmitted: (_) => submit(),
                ),
                if (error != null) ...[
                  const SizedBox(height: MpSpacing.sm),
                  Text(error!, style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
                ],
                const SizedBox(height: MpSpacing.md),
                FilledButton(
                  onPressed: saving ? null : submit,
                  child: saving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save password'),
                ),
              ],
            ),
          );
        },
      );
    },
  );

  passwordCtrl.dispose();
  confirmCtrl.dispose();
}
