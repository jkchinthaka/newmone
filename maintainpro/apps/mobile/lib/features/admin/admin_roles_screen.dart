import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/admin_api_client.dart';
import 'data/admin_models.dart';

class AdminRolesScreen extends ConsumerStatefulWidget {
  const AdminRolesScreen({super.key});

  @override
  ConsumerState<AdminRolesScreen> createState() => _AdminRolesScreenState();
}

class _AdminRolesScreenState extends ConsumerState<AdminRolesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = true;
  String? _error;
  List<RoleRow> _roles = const [];
  List<PermissionRow> _permissions = const [];
  String _permQ = '';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(adminApiClientProvider);
      List<RoleRow> roles = const [];
      List<PermissionRow> perms = const [];
      try {
        final matrix = await client.rolesPermissionsMatrix();
        roles = asMapList(matrix['roles']).map(RoleRow.fromJson).toList();
        perms = asMapList(matrix['permissions']).map(PermissionRow.fromJson).toList();
      } catch (_) {
        roles = await client.listRoles();
        perms = await client.listPermissions();
      }
      if (!mounted) return;
      setState(() {
        _roles = roles;
        _permissions = perms;
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
    final filteredPerms = _permQ.trim().isEmpty
        ? _permissions
        : _permissions
            .where((p) =>
                p.key.toLowerCase().contains(_permQ.toLowerCase()) ||
                (p.module ?? '').toLowerCase().contains(_permQ.toLowerCase()))
            .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Roles & permissions'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Roles'),
            Tab(text: 'Permissions'),
          ],
        ),
      ),
      body: _loading
          ? const MpLoading(message: 'Loading roles…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : TabBarView(
                  controller: _tabs,
                  children: [
                    ListView.separated(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      itemCount: _roles.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: MpSpacing.sm),
                      itemBuilder: (context, i) {
                        final r = _roles[i];
                        return MpCard(
                          onTap: () => showModalBottomSheet<void>(
                            context: context,
                            isScrollControlled: true,
                            builder: (_) => DraggableScrollableSheet(
                              expand: false,
                              initialChildSize: 0.6,
                              builder: (ctx, scroll) => ListView(
                                controller: scroll,
                                padding: const EdgeInsets.all(MpSpacing.lg),
                                children: [
                                  Text(r.name,
                                      style: Theme.of(ctx).textTheme.titleLarge),
                                  Text('${r.permissionCount} permissions'),
                                  if (r.tenantName != null) Text(r.tenantName!),
                                  const SizedBox(height: MpSpacing.md),
                                  ...r.permissionKeys.map((k) => ListTile(
                                        dense: true,
                                        title: Text(k),
                                        contentPadding: EdgeInsets.zero,
                                      )),
                                  if (r.permissionKeys.isEmpty)
                                    const Text(
                                      'Permission keys not included in this payload. '
                                      'Catalog is on the Permissions tab.',
                                    ),
                                ],
                              ),
                            ),
                          ),
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(r.name),
                            subtitle: Text(
                              [
                                '${r.permissionCount} permissions',
                                if (r.tenantName != null) r.tenantName!,
                                if (r.isBuiltIn) 'Built-in',
                              ].join(' · '),
                            ),
                            trailing: const Icon(Icons.chevron_right),
                          ),
                        );
                      },
                    ),
                    Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(MpSpacing.screenPadding),
                          child: TextField(
                            decoration: const InputDecoration(
                              labelText: 'Search permissions',
                              prefixIcon: Icon(Icons.search),
                              border: OutlineInputBorder(),
                            ),
                            onChanged: (v) => setState(() => _permQ = v),
                          ),
                        ),
                        Expanded(
                          child: ListView.separated(
                            padding: const EdgeInsets.all(MpSpacing.screenPadding),
                            itemCount: filteredPerms.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: MpSpacing.xs),
                            itemBuilder: (context, i) {
                              final p = filteredPerms[i];
                              return ListTile(
                                title: Text(p.key),
                                subtitle: Text(
                                  [
                                    if (p.module != null) p.module!,
                                    if (p.description != null) p.description!,
                                  ].join(' · '),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
    );
  }
}
