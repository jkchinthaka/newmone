import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';

enum FarmFieldType { text, number, date, dateTime, select }

class FarmField {
  const FarmField({
    required this.name,
    required this.label,
    this.type = FarmFieldType.text,
    this.required = false,
    this.options = const [],
  });

  final String name;
  final String label;
  final FarmFieldType type;
  final bool required;
  final List<String> options;
}

/// Reusable list + create-form widget for farm modules.
///
/// Hits `GET endpoint` to load rows and `POST endpoint` to create.
/// Renders one card per row with title/subtitle from the supplied callbacks.
class FarmListTab extends ConsumerStatefulWidget {
  const FarmListTab({
    super.key,
    required this.title,
    required this.endpoint,
    required this.fields,
    required this.rowTitle,
    required this.rowSubtitle,
  });

  final String title;
  final String endpoint;
  final List<FarmField> fields;
  final String Function(Map<String, dynamic> row) rowTitle;
  final String Function(Map<String, dynamic> row) rowSubtitle;

  @override
  ConsumerState<FarmListTab> createState() => _FarmListTabState();
}

class _FarmListTabState extends ConsumerState<FarmListTab>
    with AutomaticKeepAliveClientMixin {
  bool _loading = false;
  bool _showForm = false;
  String? _error;
  List<Map<String, dynamic>> _rows = const [];
  final Map<String, String> _form = {};

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(widget.endpoint);
      final data = res.data is Map ? res.data['data'] : res.data;
      final list = (data as List?) ?? const [];
      if (!mounted) return;
      setState(() {
        _rows = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Failed to load: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final missing = widget.fields
        .where((f) => f.required && (_form[f.name]?.trim().isEmpty ?? true))
        .map((f) => f.label)
        .toList();
    if (missing.isNotEmpty) {
      setState(() => _error = 'Required: ${missing.join(', ')}');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    final payload = <String, dynamic>{};
    for (final f in widget.fields) {
      final raw = _form[f.name]?.trim();
      if (raw == null || raw.isEmpty) continue;
      if (f.type == FarmFieldType.number) {
        final n = num.tryParse(raw);
        if (n != null) payload[f.name] = n;
      } else {
        payload[f.name] = raw;
      }
    }

    try {
      final dio = ref.read(dioProvider);
      await dio.post(widget.endpoint, data: payload);
      _form.clear();
      if (!mounted) return;
      setState(() => _showForm = false);
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Save failed: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDate(FarmField f) async {
    final now = DateTime.now();
    final initial = DateTime.tryParse(_form[f.name] ?? '') ?? now;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 5),
    );
    if (picked == null) return;
    if (f.type == FarmFieldType.dateTime) {
      final t = await showTimePicker(
        // ignore: use_build_context_synchronously
        context: context,
        initialTime: TimeOfDay.fromDateTime(initial),
      );
      final dt = DateTime(
        picked.year,
        picked.month,
        picked.day,
        t?.hour ?? 0,
        t?.minute ?? 0,
      );
      setState(() => _form[f.name] = dt.toIso8601String());
    } else {
      setState(() => _form[f.name] =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(widget.title,
                    style: Theme.of(context).textTheme.titleMedium),
              ),
              FilledButton.icon(
                onPressed: _loading
                    ? null
                    : () => setState(() => _showForm = !_showForm),
                icon: Icon(_showForm ? Icons.close : Icons.add),
                label: Text(_showForm ? 'Cancel' : 'New'),
              ),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          if (_showForm) _buildForm(),
          const SizedBox(height: 8),
          if (_loading && _rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('No records yet.')),
            )
          else
            ..._rows.map(_buildRow),
        ],
      ),
    );
  }

  Widget _buildForm() {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final f in widget.fields) ...[
              const SizedBox(height: 8),
              _buildField(f),
            ],
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(FarmField f) {
    final value = _form[f.name] ?? '';
    final label = f.required ? '${f.label} *' : f.label;
    switch (f.type) {
      case FarmFieldType.select:
        return DropdownButtonFormField<String>(
          initialValue: value.isEmpty ? null : value,
          decoration: InputDecoration(labelText: label),
          items: f.options
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          onChanged: (v) => setState(() => _form[f.name] = v ?? ''),
        );
      case FarmFieldType.date:
      case FarmFieldType.dateTime:
        return InkWell(
          onTap: () => _pickDate(f),
          child: InputDecorator(
            decoration: InputDecoration(labelText: label),
            child: Text(value.isEmpty ? 'Tap to pick' : value),
          ),
        );
      case FarmFieldType.number:
        return TextFormField(
          initialValue: value,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: label),
          onChanged: (v) => _form[f.name] = v,
        );
      case FarmFieldType.text:
        return TextFormField(
          initialValue: value,
          decoration: InputDecoration(labelText: label),
          onChanged: (v) => _form[f.name] = v,
        );
    }
  }

  Widget _buildRow(Map<String, dynamic> row) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        title: Text(widget.rowTitle(row)),
        subtitle: Text(widget.rowSubtitle(row)),
      ),
    );
  }
}
