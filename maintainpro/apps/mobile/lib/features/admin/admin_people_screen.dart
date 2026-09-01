import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/admin_api_client.dart';
import 'data/admin_models.dart';

class AdminPeopleScreen extends ConsumerStatefulWidget {
  const AdminPeopleScreen({super.key});

  @override
  ConsumerState<AdminPeopleScreen> createState() => _AdminPeopleScreenState();
}

class _AdminPeopleScreenState extends ConsumerState<AdminPeopleScreen> {
  bool _loading = true;
  String? _error;
  List<PersonRow> _rows = const [];
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await ref.read(adminApiClientProvider).listPeople(
            search: _search.text,
          );
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
      appBar: AppBar(title: const Text('People')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    decoration: const InputDecoration(
                      labelText: 'Search people',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _load(),
                  ),
                ),
                const SizedBox(width: MpSpacing.sm),
                IconButton(onPressed: _load, icon: const Icon(Icons.search)),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading people…')
                : _error != null
                    ? MpErrorState(
                        title: 'Could not load people',
                        message: _error,
                        onRetry: _load,
                      )
                    : _rows.isEmpty
                        ? const MpEmptyState(
                            title: 'No people',
                            message: 'No directory rows for this search.',
                            icon: Icons.badge_outlined,
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(MpSpacing.screenPadding),
                            itemCount: _rows.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: MpSpacing.sm),
                            itemBuilder: (context, i) {
                              final p = _rows[i];
                              return MpCard(
                                child: ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(p.fullName),
                                  subtitle: Text(
                                    [
                                      if (p.designation != null) p.designation!,
                                      if (p.departmentName != null) p.departmentName!,
                                      if (p.email != null) p.email!,
                                      if (p.roleName != null) p.roleName!,
                                    ].join(' · '),
                                  ),
                                  trailing: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      MpStatusChip(
                                        label: p.active ? 'Active' : 'Inactive',
                                        tone: p.active
                                            ? MpStatusTone.success
                                            : MpStatusTone.warning,
                                      ),
                                      Text(
                                        p.canLogin ? 'Login enabled' : 'No login',
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                    ],
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
