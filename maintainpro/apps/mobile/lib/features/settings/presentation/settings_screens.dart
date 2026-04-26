import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import 'providers/settings_provider.dart';

// ── Helpers ─────────────────────────────────────────────────────────────────

Widget _glassCard({required Widget child, VoidCallback? onTap}) {
  return ClipRRect(
    borderRadius: BorderRadius.circular(AppRadius.lg),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Material(
        color: AppColors.card.withValues(alpha: 0.7),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: child,
          ),
        ),
      ),
    ),
  );
}

Widget _scaffold({
  required String title,
  required Widget body,
  List<Widget>? actions,
  Widget? fab,
}) {
  return Scaffold(
    extendBodyBehindAppBar: true,
    appBar: AppBar(
      title: Text(title),
      backgroundColor: Colors.transparent,
      elevation: 0,
      actions: actions,
    ),
    floatingActionButton: fab,
    body: Container(
      decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
      child: SafeArea(child: body),
    ),
  );
}

String _humanKey(String k) {
  final spaced =
      k.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}');
  return spaced.isEmpty ? k : spaced[0].toUpperCase() + spaced.substring(1);
}

String _fmtValue(dynamic v) {
  if (v == null) return '—';
  if (v is bool) return v ? 'Yes' : 'No';
  return v.toString();
}

Widget _kv(String k, dynamic v) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
            flex: 4,
            child: Text(_humanKey(k), style: AppTextStyles.bodySecondary)),
        Expanded(
            flex: 5,
            child: Text(_fmtValue(v),
                style: AppTextStyles.body, textAlign: TextAlign.right)),
      ],
    ),
  );
}

// ── Hub ─────────────────────────────────────────────────────────────────────

class SettingsHubScreen extends ConsumerWidget {
  const SettingsHubScreen({super.key});

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content:
            const Text('You will need to log in again to access your data.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Sign out')),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(authStateProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tiles = <_SettingsTile>[
      _SettingsTile('Profile', Icons.person_outline, '/settings/profile'),
      _SettingsTile(
          'Organization', Icons.business_outlined, '/settings/organization'),
      _SettingsTile('System', Icons.settings_outlined, '/settings/system'),
      _SettingsTile(
          'Integrations', Icons.extension_outlined, '/settings/integrations'),
      _SettingsTile('Feature Toggles', Icons.toggle_on_outlined,
          '/settings/feature-toggles'),
      _SettingsTile('Automation Rules', Icons.bolt_outlined,
          '/settings/automation-rules'),
      _SettingsTile('Digest Schedules', Icons.schedule_outlined,
          '/settings/digest-schedules'),
      _SettingsTile(
          'Audit Logs', Icons.history_outlined, '/settings/audit-logs'),
      _SettingsTile('Billing', Icons.credit_card_outlined, '/billing'),
      _SettingsTile('About', Icons.info_outline, '/settings/about'),
    ];

    return _scaffold(
      title: 'Settings',
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md,
            kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
        itemCount: tiles.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (_, i) {
          if (i < tiles.length) {
            final t = tiles[i];
            return _glassCard(
              onTap: () => context.go(t.path),
              child: Row(
                children: [
                  Icon(t.icon, color: AppColors.primaryLight, size: 28),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: Text(t.label, style: AppTextStyles.subtitle)),
                  const Icon(Icons.chevron_right,
                      color: AppColors.textSecondary),
                ],
              ),
            );
          }
          return _glassCard(
            onTap: () => _confirmLogout(context, ref),
            child: Row(
              children: [
                const Icon(Icons.logout, color: AppColors.error, size: 28),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                    child: Text('Sign out',
                        style: AppTextStyles.subtitle
                            .copyWith(color: AppColors.error))),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SettingsTile {
  const _SettingsTile(this.label, this.icon, this.path);
  final String label;
  final IconData icon;
  final String path;
}

// ── Profile ─────────────────────────────────────────────────────────────────

class ProfileSettingsScreen extends ConsumerWidget {
  const ProfileSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(settingsProfileProvider);
    return _scaffold(
      title: 'Profile',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: () => ref.invalidate(settingsProfileProvider),
        ),
      ],
      body: async.when(
        data: (data) => _ProfileForm(initial: data),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({required this.initial});
  final Map<String, dynamic> initial;
  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  final _currentPwd = TextEditingController();
  final _newPwd = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _firstName = TextEditingController(
        text: widget.initial['firstName']?.toString() ?? '');
    _lastName = TextEditingController(
        text: widget.initial['lastName']?.toString() ?? '');
    _email =
        TextEditingController(text: widget.initial['email']?.toString() ?? '');
    _phone =
        TextEditingController(text: widget.initial['phone']?.toString() ?? '');
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _phone.dispose();
    _currentPwd.dispose();
    _newPwd.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'firstName': _firstName.text.trim(),
        'lastName': _lastName.text.trim(),
        'email': _email.text.trim(),
        'phone': _phone.text.trim(),
        if (_currentPwd.text.isNotEmpty) 'currentPassword': _currentPwd.text,
        if (_newPwd.text.isNotEmpty) 'newPassword': _newPwd.text,
      };
      await ref.read(settingsRemoteProvider).updateProfile(body);
      ref.invalidate(settingsProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profile updated')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md,
          kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
      children: [
        _glassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                  controller: _firstName,
                  decoration: const InputDecoration(labelText: 'First name')),
              TextField(
                  controller: _lastName,
                  decoration: const InputDecoration(labelText: 'Last name')),
              TextField(
                  controller: _email,
                  decoration: const InputDecoration(labelText: 'Email'),
                  keyboardType: TextInputType.emailAddress),
              TextField(
                  controller: _phone,
                  decoration: const InputDecoration(labelText: 'Phone'),
                  keyboardType: TextInputType.phone),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text('Change password', style: AppTextStyles.subtitle),
        const SizedBox(height: AppSpacing.xs),
        _glassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                  controller: _currentPwd,
                  obscureText: true,
                  decoration:
                      const InputDecoration(labelText: 'Current password')),
              TextField(
                  controller: _newPwd,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'New password')),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        FilledButton.icon(
          onPressed: _saving ? null : _save,
          icon: _saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.save),
          label: const Text('Save'),
        ),
      ],
    );
  }
}

// ── Generic editable map screen ─────────────────────────────────────────────

class _EditableMapScreen extends ConsumerStatefulWidget {
  const _EditableMapScreen({
    required this.title,
    required this.provider,
    required this.onSave,
  });
  final String title;
  final AutoDisposeFutureProvider<Map<String, dynamic>> provider;
  final Future<void> Function(WidgetRef ref, Map<String, dynamic> body) onSave;

  @override
  ConsumerState<_EditableMapScreen> createState() => _EditableMapScreenState();
}

class _EditableMapScreenState extends ConsumerState<_EditableMapScreen> {
  final Map<String, TextEditingController> _ctrls = {};
  Map<String, dynamic>? _seed;
  bool _saving = false;

  void _initControllers(Map<String, dynamic> data) {
    if (_seed != null) return;
    _seed = data;
    for (final e in data.entries) {
      if (e.value is! Map && e.value is! List) {
        _ctrls[e.key] = TextEditingController(
            text: e.value == null ? '' : e.value.toString());
      }
    }
  }

  @override
  void dispose() {
    for (final c in _ctrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{};
      for (final e in _ctrls.entries) {
        final raw = e.key;
        final original = _seed?[raw];
        final txt = e.value.text.trim();
        if (original is num) {
          final parsed = num.tryParse(txt);
          if (parsed != null) body[raw] = parsed;
        } else {
          body[raw] = txt;
        }
      }
      await widget.onSave(ref, body);
      ref.invalidate(widget.provider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Saved')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(widget.provider);
    return _scaffold(
      title: widget.title,
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: () {
            _seed = null;
            for (final c in _ctrls.values) {
              c.dispose();
            }
            _ctrls.clear();
            ref.invalidate(widget.provider);
          },
        ),
      ],
      body: async.when(
        data: (data) {
          _initControllers(data);
          final nestedMaps = data.entries
              .where((e) => e.value is Map<String, dynamic>)
              .toList();
          final lists = data.entries.where((e) => e.value is List).toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md,
                kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
            children: [
              if (_ctrls.isNotEmpty)
                _glassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final e in _ctrls.entries)
                        TextField(
                          controller: e.value,
                          decoration:
                              InputDecoration(labelText: _humanKey(e.key)),
                        ),
                    ],
                  ),
                ),
              for (final nm in nestedMaps) ...[
                const SizedBox(height: AppSpacing.md),
                Text(_humanKey(nm.key), style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.xs),
                _glassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final inner
                          in (nm.value as Map<String, dynamic>).entries)
                        _kv(inner.key, inner.value),
                    ],
                  ),
                ),
              ],
              for (final l in lists) ...[
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                        child: Text(_humanKey(l.key),
                            style: AppTextStyles.subtitle)),
                    Text('${(l.value as List).length}',
                        style: AppTextStyles.bodySecondary),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                if ((l.value as List).isEmpty)
                  Text('No items', style: AppTextStyles.bodySecondary)
                else
                  for (final item in (l.value as List).take(20))
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                      child: _glassCard(
                        child: Text(item.toString(), style: AppTextStyles.body),
                      ),
                    ),
              ],
              const SizedBox(height: AppSpacing.md),
              if (_ctrls.isNotEmpty)
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.save),
                  label: const Text('Save'),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

class OrganizationSettingsScreen extends StatelessWidget {
  const OrganizationSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return _EditableMapScreen(
      title: 'Organization',
      provider: settingsOrganizationProvider,
      onSave: (ref, body) =>
          ref.read(settingsRemoteProvider).updateOrganization(body),
    );
  }
}

class SystemSettingsScreen extends StatelessWidget {
  const SystemSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return _EditableMapScreen(
      title: 'System',
      provider: settingsSystemProvider,
      onSave: (ref, body) =>
          ref.read(settingsRemoteProvider).updateSystem(body),
    );
  }
}

class IntegrationsSettingsScreen extends StatelessWidget {
  const IntegrationsSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return _EditableMapScreen(
      title: 'Integrations',
      provider: settingsIntegrationsProvider,
      onSave: (ref, body) =>
          ref.read(settingsRemoteProvider).updateIntegrations(body),
    );
  }
}

// ── Feature toggles ─────────────────────────────────────────────────────────

class FeatureTogglesScreen extends ConsumerStatefulWidget {
  const FeatureTogglesScreen({super.key});
  @override
  ConsumerState<FeatureTogglesScreen> createState() =>
      _FeatureTogglesScreenState();
}

class _FeatureTogglesScreenState extends ConsumerState<FeatureTogglesScreen> {
  final Map<String, bool> _local = {};
  bool _saving = false;

  Map<String, bool> _flatten(Map<String, dynamic> data) {
    final out = <String, bool>{};
    void walk(String prefix, dynamic node) {
      if (node is Map<String, dynamic>) {
        for (final e in node.entries) {
          final key = prefix.isEmpty ? e.key : '$prefix.${e.key}';
          walk(key, e.value);
        }
      } else if (node is bool) {
        out[prefix] = node;
      }
    }

    walk('', data);
    return out;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref
          .read(settingsRemoteProvider)
          .updateFeatureToggles(Map<String, bool>.from(_local));
      ref.invalidate(settingsFeatureTogglesProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Toggles updated')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(settingsFeatureTogglesProvider);
    return _scaffold(
      title: 'Feature Toggles',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: () {
            _local.clear();
            ref.invalidate(settingsFeatureTogglesProvider);
          },
        ),
      ],
      body: async.when(
        data: (data) {
          final flat = _flatten(data);
          if (_local.isEmpty) _local.addAll(flat);
          if (_local.isEmpty) {
            return Center(
                child: Text('No feature toggles defined',
                    style: AppTextStyles.bodySecondary));
          }
          final keys = _local.keys.toList()..sort();
          return ListView(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md,
                kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
            children: [
              _glassCard(
                child: Column(
                  children: [
                    for (final k in keys)
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(_humanKey(k.split('.').last),
                            style: AppTextStyles.body),
                        subtitle: k.contains('.')
                            ? Text(k, style: AppTextStyles.caption)
                            : null,
                        value: _local[k] ?? false,
                        onChanged: (v) => setState(() => _local[k] = v),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.save),
                label: const Text('Save'),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

// ── List-based screens (rules, schedules, audit) ────────────────────────────

class _ListMapsScreen extends ConsumerWidget {
  const _ListMapsScreen({
    required this.title,
    required this.provider,
  });
  final String title;
  final AutoDisposeFutureProvider<List<Map<String, dynamic>>> provider;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(provider);
    return _scaffold(
      title: title,
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: () => ref.invalidate(provider),
        ),
      ],
      body: async.when(
        data: (items) {
          if (items.isEmpty) {
            return Center(
                child: Text('No items', style: AppTextStyles.bodySecondary));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(provider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md,
                  kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
              itemCount: items.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: AppSpacing.sm),
              itemBuilder: (_, i) {
                final m = items[i];
                return _glassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final e in m.entries) _kv(e.key, e.value),
                    ],
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

class AutomationRulesScreen extends StatelessWidget {
  const AutomationRulesScreen({super.key});
  @override
  Widget build(BuildContext context) => _ListMapsScreen(
      title: 'Automation Rules', provider: settingsAutomationRulesProvider);
}

class DigestSchedulesScreen extends StatelessWidget {
  const DigestSchedulesScreen({super.key});
  @override
  Widget build(BuildContext context) => _ListMapsScreen(
      title: 'Digest Schedules', provider: settingsDigestSchedulesProvider);
}

class AuditLogsScreen extends ConsumerStatefulWidget {
  const AuditLogsScreen({super.key});
  @override
  ConsumerState<AuditLogsScreen> createState() => _AuditLogsScreenState();
}

class _AuditLogsScreenState extends ConsumerState<AuditLogsScreen> {
  String? _entity;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(settingsAuditLogsProvider(_entity));
    return _scaffold(
      title: 'Audit Logs',
      actions: [
        IconButton(
          icon: const Icon(Icons.filter_list),
          onPressed: () async {
            final ctrl = TextEditingController(text: _entity ?? '');
            final picked = await showDialog<String?>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Filter by entity'),
                content: TextField(
                    controller: ctrl,
                    decoration:
                        const InputDecoration(hintText: 'e.g. WorkOrder')),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, null),
                      child: const Text('Clear')),
                  FilledButton(
                      onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
                      child: const Text('Apply')),
                ],
              ),
            );
            setState(() {
              _entity = picked == null || picked.isEmpty ? null : picked;
            });
          },
        ),
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: () => ref.invalidate(settingsAuditLogsProvider),
        ),
      ],
      body: async.when(
        data: (items) {
          if (items.isEmpty) {
            return Center(
                child:
                    Text('No audit logs', style: AppTextStyles.bodySecondary));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(settingsAuditLogsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md,
                  kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
              itemCount: items.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: AppSpacing.sm),
              itemBuilder: (_, i) {
                final m = items[i];
                final action =
                    (m['action'] ?? m['eventType'] ?? 'event').toString();
                final entity =
                    (m['entity'] ?? m['entityType'] ?? '').toString();
                final actor = (m['actorEmail'] ?? m['userId'] ?? '').toString();
                final ts = (m['createdAt'] ?? m['timestamp'] ?? '').toString();
                return _glassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                              child:
                                  Text(action, style: AppTextStyles.subtitle)),
                          if (entity.isNotEmpty)
                            Text(entity, style: AppTextStyles.caption),
                        ],
                      ),
                      if (actor.isNotEmpty)
                        Text(actor, style: AppTextStyles.bodySecondary),
                      if (ts.isNotEmpty) Text(ts, style: AppTextStyles.caption),
                    ],
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}
