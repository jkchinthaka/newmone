import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../shared/models/app_user.dart';

/// Cleaning module entry point for the mobile app.
///
/// Cleaners use this screen to scan a washroom QR code, complete the
/// checklist, attach photos, and submit a visit. Supervisors use the
/// "Awaiting" tab to approve / reject submitted visits.
class CleaningScreen extends ConsumerStatefulWidget {
  const CleaningScreen({super.key, required this.user});

  final AppUser user;

  @override
  ConsumerState<CleaningScreen> createState() => _CleaningScreenState();
}

class _CleaningScreenState extends ConsumerState<CleaningScreen> {
  final _qrController = TextEditingController();
  bool _busy = false;
  String? _error;
  Map<String, dynamic>? _activeVisit;
  List<Map<String, dynamic>> _items = [];

  bool get _isSupervisor =>
      widget.user.role == UserRole.supervisor ||
      widget.user.role == UserRole.admin ||
      widget.user.role == UserRole.superAdmin;

  Future<void> _scan() async {
    final code = _qrController.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post(
        '/cleaning/visits/scan',
        data: {'qrCode': code},
      );
      final visit = (res.data['data'] ?? res.data) as Map<String, dynamic>;
      final checklist = visit['checklist'] as Map<String, dynamic>?;
      final items = (checklist?['items'] as List?) ?? const [];

      setState(() {
        _activeVisit = visit;
        _items = items
            .whereType<Map>()
            .map((e) => {
                  'label': e['label'] ?? '',
                  'checked': e['checked'] ?? false,
                  'note': e['note'] ?? '',
                })
            .toList();
      });
    } catch (e) {
      setState(() => _error = 'Could not start visit: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    final visit = _activeVisit;
    if (visit == null) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/cleaning/visits/${visit['id']}/submit',
        data: {
          'checklist': _items
              .map((i) => {
                    'label': i['label'],
                    'checked': i['checked'],
                    if ((i['note'] as String).isNotEmpty) 'note': i['note'],
                  })
              .toList(),
          'afterPhotos': const <String>[],
        },
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Visit submitted for sign-off.')),
      );
      setState(() {
        _activeVisit = null;
        _items = [];
        _qrController.clear();
      });
    } catch (e) {
      setState(() => _error = 'Submit failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _qrController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _isSupervisor ? 2 : 1,
      child: Column(
        children: [
          if (_isSupervisor)
            const TabBar(
              tabs: [
                Tab(icon: Icon(Icons.qr_code), text: 'Log Visit'),
                Tab(icon: Icon(Icons.fact_check), text: 'Awaiting'),
              ],
            ),
          Expanded(
            child: TabBarView(
              children: [
                _logVisitView(),
                if (_isSupervisor) const _SignOffQueue(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _logVisitView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: Colors.green.shade50,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Cleaning Visit',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _qrController,
                    decoration: const InputDecoration(
                      labelText: 'QR code value',
                      hintText: 'CLN-XXXXXXXX',
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _busy ? null : _scan,
                    icon: const Icon(Icons.qr_code_scanner),
                    label: Text(_busy ? 'Scanning...' : 'Start visit'),
                  ),
                ],
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          if (_activeVisit != null) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Active visit at ${_activeVisit!['location']?['name'] ?? ''}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    if (_items.isEmpty)
                      const Text(
                          'No checklist items defined for this location.'),
                    ..._items.asMap().entries.map(
                          (entry) => CheckboxListTile(
                            title: Text(entry.value['label'].toString()),
                            value: entry.value['checked'] == true,
                            onChanged: (v) => setState(() {
                              _items[entry.key]['checked'] = v ?? false;
                            }),
                          ),
                        ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _busy ? null : _submit,
                      icon: const Icon(Icons.send),
                      label:
                          Text(_busy ? 'Submitting...' : 'Submit for sign-off'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SignOffQueue extends ConsumerStatefulWidget {
  const _SignOffQueue();

  @override
  ConsumerState<_SignOffQueue> createState() => _SignOffQueueState();
}

class _SignOffQueueState extends ConsumerState<_SignOffQueue> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dio = ref.read(dioProvider);
      final res = await dio
          .get('/cleaning/visits', queryParameters: {'status': 'SUBMITTED'});
      final list = (res.data['data'] ?? res.data ?? []) as List;
      setState(() => _rows = list.cast<Map<String, dynamic>>());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _decide(String id, bool approve) async {
    String? reason;
    if (!approve) {
      reason = await showDialog<String>(
        context: context,
        builder: (ctx) {
          final c = TextEditingController();
          return AlertDialog(
            title: const Text('Rejection reason'),
            content: TextField(controller: c),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, c.text.trim()),
                child: const Text('Reject'),
              ),
            ],
          );
        },
      );
      if (reason == null || reason.isEmpty) return;
    }

    final dio = ref.read(dioProvider);
    await dio.post('/cleaning/visits/$id/sign-off', data: {
      'approve': approve,
      if (reason != null) 'rejectionReason': reason,
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_rows.isEmpty) {
      return const Center(child: Text('No visits awaiting sign-off.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _rows.length,
        itemBuilder: (context, i) {
          final v = _rows[i];
          final loc = v['location'] as Map<String, dynamic>?;
          final cleaner = v['cleaner'] as Map<String, dynamic>?;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(loc?['name'] ?? 'Unknown location',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(
                    'By ${cleaner?['firstName'] ?? ''} ${cleaner?['lastName'] ?? ''}',
                    style: const TextStyle(color: Colors.black54),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      OutlinedButton(
                        onPressed: () => _decide(v['id'].toString(), false),
                        child: const Text('Reject'),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: () => _decide(v['id'].toString(), true),
                        child: const Text('Approve'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
