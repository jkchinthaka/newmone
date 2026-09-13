import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/database/app_database.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/connectivity_provider.dart';
import '../../core/tenant/tenant_context.dart';
import '../../core/widgets/offline_banner.dart';
import '../../design_system/design_system.dart';
import '../work_orders/data/work_orders_repository.dart';
import 'data/cl30_draft_store.dart';
import 'data/fg_api_client.dart';
import 'data/fg_models.dart';

/// FG controlled-form recorder — vehicle/date/room open modes, dynamic fields,
/// local draft autosave, online save/submit with idempotencyKey.
class FgFormRecorderScreen extends ConsumerStatefulWidget {
  const FgFormRecorderScreen({
    super.key,
    required this.config,
    this.recordId,
    this.resumeDraftId,
  });

  final FgFormConfig config;
  final String? recordId;
  final String? resumeDraftId;

  @override
  ConsumerState<FgFormRecorderScreen> createState() =>
      _FgFormRecorderScreenState();
}

class _FgFormRecorderScreenState extends ConsumerState<FgFormRecorderScreen> {
  static const _uuid = Uuid();

  final _searchController = TextEditingController();
  late final TextEditingController _dateController;
  final _submitGuard = InFlightGuard();
  final Map<String, TextEditingController> _fieldControllers = {};

  Timer? _searchDebounce;
  Timer? _draftDebounce;

  List<VehicleResult> _vehicles = [];
  VehicleResult? _selectedVehicle;
  String? _occurrenceToken;
  String? _localDraftId;
  String? _recordId;
  FgRecordDetail? _detail;
  int? _draftVersion;
  Map<String, String> _fields = {};

  String? _selectedRoom = kFgColdRoomKeys.first;
  String _recordDate = DateTime.now().toIso8601String().split('T').first;

  bool _searching = false;
  bool _opening = false;
  bool _loadingRecord = false;
  bool _saving = false;
  bool _submitting = false;
  String? _error;
  String? _validationMessage;
  Map<String, List<String>>? _fieldErrors;

  FgFormConfig get _config => widget.config;

  @override
  void initState() {
    super.initState();
    _recordId = widget.recordId;
    _localDraftId = widget.resumeDraftId ?? _uuid.v4();
    _occurrenceToken = _uuid.v4();
    _recordDate = DateTime.now().toIso8601String().split('T').first;
    _dateController = TextEditingController(text: _recordDate);
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrapLoad());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _draftDebounce?.cancel();
    _searchController.dispose();
    _dateController.dispose();
    for (final c in _fieldControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _bootstrapLoad() async {
    final draftId = widget.resumeDraftId;
    if (draftId != null) {
      await _loadLocalDraft(draftId);
    }
    if (_recordId != null && _recordId!.isNotEmpty) {
      await _fetchRecord(_recordId!);
    }
  }

  Future<void> _loadLocalDraft(String draftId) async {
    final auth = ref.read(authControllerProvider).user;
    final tenant = ref.read(tenantContextProvider);
    if (auth == null || !tenant.hasTenant) return;
    final store = ref.read(cl30DraftStoreProvider);
    final drafts = await store.list(
      tenantId: tenant.tenantId!,
      userId: auth.id,
    );
    LocalDraft? match;
    for (final d in drafts) {
      if (d.draftId == draftId) {
        match = d;
        break;
      }
    }
    if (match == null) return;
    final payload = store.parsePayload(match);
    if (payload == null) return;
    setState(() {
      _localDraftId = payload.localDraftId;
      _occurrenceToken = payload.occurrenceToken.isNotEmpty
          ? payload.occurrenceToken
          : _occurrenceToken;
      _recordId = payload.recordId ?? _recordId;
      _draftVersion = payload.draftVersion;
      _fields = payload.fields.map((k, v) => MapEntry(k, v?.toString() ?? ''));
      if (payload.vehicleId != null) {
        _selectedVehicle = VehicleResult(
          id: payload.vehicleId!,
          label: payload.vehicleId!,
          selectable: true,
        );
      }
    });
  }

  void _onSearchChanged(String q) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      _runSearch(q.trim());
    });
  }

  Future<void> _runSearch(String q) async {
    if (q.isEmpty) {
      setState(() => _vehicles = []);
      return;
    }
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final results = await ref
          .read(fgApiClientProvider)
          .searchFormVehicles(_config.slug, q);
      if (!mounted) return;
      setState(() {
        _vehicles = results;
        _searching = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _searching = false;
      });
    }
  }

  Future<void> _openDailyRecord() async {
    setState(() {
      _opening = true;
      _error = null;
      _validationMessage = null;
    });
    try {
      final opened = await ref.read(fgApiClientProvider).openFormRecord(
            slug: _config.slug,
            date: _recordDate,
            room: _config.openMode == FgFormOpenMode.roomAndDate
                ? _selectedRoom
                : null,
          );
      if (!mounted) return;
      _recordId = opened.record.id;
      await _fetchRecord(opened.record.id);
      await _persistLocalDraft();
      if (!mounted) return;
      setState(() => _opening = false);
      if (widget.recordId == null && mounted) {
        context.replace('${_config.routePrefix}/records/${opened.record.id}');
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _opening = false;
        _error = e.message;
        _absorbFieldErrors(e);
      });
    }
  }

  Future<void> _selectVehicle(VehicleResult v) async {
    if (!v.selectable) return;
    setState(() {
      _selectedVehicle = v;
      _opening = true;
      _error = null;
      _validationMessage = null;
    });
    try {
      final token = _occurrenceToken ?? _uuid.v4();
      _occurrenceToken = token;
      final opened = await ref.read(fgApiClientProvider).openFormRecord(
            slug: _config.slug,
            occurrenceToken: token,
          );
      if (!mounted) return;
      _recordId = opened.record.id;
      await _fetchRecord(opened.record.id);
      _applyVehicleToFields(v);
      await _persistLocalDraft();
      if (!mounted) return;
      setState(() => _opening = false);
      if (widget.recordId == null && mounted) {
        context.replace('${_config.routePrefix}/records/${opened.record.id}');
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _opening = false;
        _error = e.message;
        _absorbFieldErrors(e);
      });
    }
  }

  void _applyVehicleToFields(VehicleResult v) {
    final label = v.registrationNo ?? v.label;
    for (final section
        in _detail?.editorSections ?? const <FgEditorSection>[]) {
      for (final field in section.fields) {
        if (field.isVehicleField ||
            (field.code ?? '').toUpperCase() == 'VEHICLE') {
          _fields[field.key] = label;
          _fieldControllers[field.key]?.text = label;
        }
      }
    }
  }

  Future<void> _fetchRecord(String id) async {
    setState(() {
      _loadingRecord = true;
      _error = null;
    });
    try {
      final detail =
          await ref.read(fgApiClientProvider).getFormRecord(_config.slug, id);
      if (!mounted) return;
      setState(() {
        _applyDetail(detail);
        _loadingRecord = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingRecord = false;
        _error = e.message;
      });
    }
  }

  void _applyDetail(FgRecordDetail detail) {
    for (final c in _fieldControllers.values) {
      c.dispose();
    }
    _fieldControllers.clear();
    final merged = Map<String, String>.from(detail.fieldValues);
    _fields.forEach((k, v) {
      if (v.isNotEmpty) merged[k] = v;
    });
    _fields = merged;
    for (final section in detail.editorSections) {
      for (final field in section.fields) {
        _fieldControllers[field.key] = TextEditingController(
          text: _fields[field.key] ?? field.value,
        );
      }
    }
    _detail = detail;
    _draftVersion = detail.expectedDraftVersion ?? detail.draftVersion;
    _recordId = detail.record.id;
  }

  void _onFieldChanged(String key, String value) {
    _fields[key] = value;
    _draftDebounce?.cancel();
    _draftDebounce = Timer(const Duration(milliseconds: 500), () {
      _persistLocalDraft();
      _maybeOnlineSave();
    });
  }

  Future<void> _persistLocalDraft() async {
    final auth = ref.read(authControllerProvider).user;
    final tenant = ref.read(tenantContextProvider);
    if (auth == null || !tenant.hasTenant) return;
    final store = ref.read(cl30DraftStoreProvider);
    await store.save(
      tenantId: tenant.tenantId!,
      userId: auth.id,
      localDraftId: _localDraftId,
      fields: Map<String, dynamic>.from(_fields),
      occurrenceToken: _occurrenceToken ?? _uuid.v4(),
      vehicleId: _selectedVehicle?.id,
      recordId: _recordId,
      draftVersion: _draftVersion,
      title: _selectedVehicle?.label ?? '${_config.title} draft',
      // displayDate only — never authoritative businessDate from device.
      displayDate: DateTime.now().toIso8601String().split('T').first,
    );
  }

  Future<void> _maybeOnlineSave() async {
    final online = ref.read(isOnlineProvider);
    final recordId = _recordId;
    final version = _draftVersion;
    final detail = _detail;
    if (!online ||
        recordId == null ||
        version == null ||
        detail == null ||
        detail.readOnly ||
        !detail.canEdit) {
      return;
    }
    setState(() => _saving = true);
    try {
      final result = await ref.read(fgApiClientProvider).saveFormRecord(
            slug: _config.slug,
            recordId: recordId,
            fields: Map<String, dynamic>.from(_fields),
            expectedDraftVersion: version,
          );
      if (!mounted) return;
      if (result.draftVersion != null) {
        _draftVersion = result.draftVersion;
      }
      setState(() {
        _saving = false;
        _validationMessage = null;
        _fieldErrors = null;
      });
      await _persistLocalDraft();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _absorbFieldErrors(e);
        _validationMessage = e.message;
      });
    }
  }

  void _absorbFieldErrors(ApiException e) {
    final details = e.details;
    if (details is Map) {
      final map = Map<String, dynamic>.from(details);
      final fe = map['fieldErrors'] ??
          (map['data'] is Map ? (map['data'] as Map)['fieldErrors'] : null);
      if (fe is Map) {
        _fieldErrors = fe.map(
          (k, v) => MapEntry(
            k.toString(),
            v is List ? v.map((e) => e.toString()).toList() : [v.toString()],
          ),
        );
      }
    }
  }

  Future<void> _submitSafe() async {
    final online = ref.read(isOnlineProvider);
    if (!online) {
      setState(
        () => _validationMessage = 'Submit requires a network connection.',
      );
      return;
    }
    final recordId = _recordId;
    if (recordId == null) return;

    setState(() {
      _submitting = true;
      _validationMessage = null;
      _error = null;
    });

    try {
      final outcome = await _submitGuard.run(() async {
        final version = _draftVersion;
        if (version != null) {
          final saved = await ref.read(fgApiClientProvider).saveFormRecord(
                slug: _config.slug,
                recordId: recordId,
                fields: Map<String, dynamic>.from(_fields),
                expectedDraftVersion: version,
              );
          if (saved.draftVersion != null) {
            _draftVersion = saved.draftVersion;
          }
        }
        // Server idempotencyKey — Nest forwards to Django submit.
        final key = _uuid.v4();
        return ref.read(fgApiClientProvider).submitFormRecord(
              slug: _config.slug,
              recordId: recordId,
              idempotencyKey: key,
            );
      });
      if (!mounted) return;
      if (outcome == null) {
        setState(() {
          _submitting = false;
          _validationMessage = 'Submit already in progress.';
        });
        return;
      }
      setState(() => _submitting = false);
      if (_localDraftId != null) {
        await ref.read(cl30DraftStoreProvider).delete(_localDraftId!);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${_config.title} submitted')),
      );
      context.go('/fg');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _absorbFieldErrors(e);
        _validationMessage = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final online = ref.watch(isOnlineProvider);
    final detail = _detail;

    return Scaffold(
      appBar: AppBar(
        title: Text('${_config.title} recorder'),
        actions: [
          if (_saving)
            const Padding(
              padding: EdgeInsets.all(MpSpacing.md),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          if (!online)
            Material(
              color: Theme.of(context).colorScheme.errorContainer,
              child: const Padding(
                padding: EdgeInsets.all(MpSpacing.sm),
                child: Text(
                  'Offline — drafts save locally. Submit is blocked until you reconnect.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              children: [
                Text(
                  _config.formCode,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: MpSpacing.xs),
                Text(
                  _config.subtitle,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: MpSpacing.lg),
                if (_error != null) ...[
                  MpErrorState(title: 'Error', message: _error),
                  const SizedBox(height: MpSpacing.md),
                ],
                if (_validationMessage != null) ...[
                  MpCard(
                    color: Theme.of(context).colorScheme.errorContainer,
                    child: Text(_validationMessage!),
                  ),
                  const SizedBox(height: MpSpacing.md),
                ],
                if (_fieldErrors != null && _fieldErrors!.isNotEmpty) ...[
                  MpCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Validation',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        ..._fieldErrors!.entries.map(
                          (e) => Text('${e.key}: ${e.value.join(', ')}'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: MpSpacing.md),
                ],
                if (_recordId == null &&
                    _config.openMode == FgFormOpenMode.vehicleOccurrence) ...[
                  const MpSectionHeader(
                    title: 'Vehicle',
                    subtitle: 'Search and select a selectable vehicle',
                  ),
                  MpTextField(
                    controller: _searchController,
                    label: 'Search vehicles',
                    hint: 'Registration / asset…',
                    prefixIcon: Icons.search,
                    onChanged: _onSearchChanged,
                  ),
                  if (_searching) const MpLoading(message: 'Searching…'),
                  if (_opening) const MpLoading(message: 'Opening record…'),
                  ..._vehicles.map((v) {
                    final enabled = v.selectable;
                    return Padding(
                      padding: const EdgeInsets.only(top: MpSpacing.sm),
                      child: MpCard(
                        onTap: enabled ? () => _selectVehicle(v) : null,
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(v.label),
                          subtitle: Text(
                            [
                              if (v.type != null) v.type!,
                              if (v.status != null) v.status!,
                              if (!enabled)
                                v.unavailableReason ?? 'Not selectable',
                            ].join(' · '),
                          ),
                          trailing: enabled
                              ? const Icon(Icons.chevron_right)
                              : const MpStatusChip(
                                  label: 'Unavailable',
                                  tone: MpStatusTone.warning,
                                ),
                        ),
                      ),
                    );
                  }),
                ],
                if (_recordId == null &&
                    _config.openMode == FgFormOpenMode.dateOnly) ...[
                  const MpSectionHeader(
                    title: 'Record date',
                    subtitle: 'One record per authoritative day (server enforced)',
                  ),
                  MpTextField(
                    controller: _dateController,
                    label: 'Date (YYYY-MM-DD)',
                    prefixIcon: Icons.calendar_today,
                    onChanged: (v) => _recordDate = v.trim(),
                  ),
                  const SizedBox(height: MpSpacing.md),
                  MpButton(
                    label: 'Open today\'s record',
                    icon: Icons.play_arrow,
                    isLoading: _opening,
                    onPressed: _opening ? null : _openDailyRecord,
                  ),
                ],
                if (_recordId == null &&
                    _config.openMode == FgFormOpenMode.roomAndDate) ...[
                  const MpSectionHeader(
                    title: 'Cold room',
                    subtitle: 'Room + date uniqueness enforced by server',
                  ),
                  Wrap(
                    spacing: MpSpacing.sm,
                    children: kFgColdRoomKeys.map((room) {
                      return ChoiceChip(
                        label: Text(room),
                        selected: _selectedRoom == room,
                        onSelected: (_) => setState(() => _selectedRoom = room),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: MpSpacing.sm),
                  MpTextField(
                    controller: _dateController,
                    label: 'Date (YYYY-MM-DD)',
                    prefixIcon: Icons.calendar_today,
                    onChanged: (v) => _recordDate = v.trim(),
                  ),
                  const SizedBox(height: MpSpacing.md),
                  MpButton(
                    label: 'Open record',
                    icon: Icons.play_arrow,
                    isLoading: _opening,
                    onPressed: _opening ? null : _openDailyRecord,
                  ),
                ],
                if (_loadingRecord) const MpLoading(message: 'Loading record…'),
                if (detail != null && detail.editorSections.isNotEmpty) ...[
                  if (_selectedVehicle != null)
                    MpStatusChip(
                      label: _selectedVehicle!.label,
                      tone: MpStatusTone.info,
                    ),
                  const SizedBox(height: MpSpacing.sm),
                  ..._buildEditor(detail),
                  const SizedBox(height: MpSpacing.xl),
                  if (detail.canSubmit && !detail.readOnly)
                    MpButton(
                      label: online ? 'Submit' : 'Submit (online only)',
                      icon: Icons.send,
                      isLoading: _submitting,
                      onPressed: (!online || _submitting) ? null : _submitSafe,
                    ),
                ] else if (detail != null &&
                    detail.snapshot != null &&
                    detail.snapshot!.isNotEmpty) ...[
                  ..._buildSnapshot(detail.snapshot!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildEditor(FgRecordDetail detail) {
    final widgets = <Widget>[];
    for (final section in detail.editorSections) {
      widgets.add(MpSectionHeader(title: section.title));
      for (final field in section.fields) {
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(bottom: MpSpacing.md),
            child: field.isChoice
                ? _buildChoiceField(field, enabled: detail.canEdit)
                : MpTextField(
                    controller: _fieldControllers[field.key],
                    label: field.required ? '${field.label} *' : field.label,
                    hint: field.helpText,
                    enabled: detail.canEdit && !detail.readOnly,
                    onChanged: (v) => _onFieldChanged(field.key, v),
                  ),
          ),
        );
      }
    }
    return widgets;
  }

  Widget _buildChoiceField(FgEditorField field, {required bool enabled}) {
    final options = field.options.isNotEmpty
        ? field.options
        : const [
            FgFieldOption(value: 'YES', label: 'PASS'),
            FgFieldOption(value: 'NO', label: 'FAIL'),
          ];
    final current = _fields[field.key] ?? field.value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          field.required ? '${field.label} *' : field.label,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: MpSpacing.xs),
        Wrap(
          spacing: MpSpacing.sm,
          children: options.map((o) {
            final selected = current == o.value;
            return ChoiceChip(
              label: Text(o.label),
              selected: selected,
              onSelected: !enabled
                  ? null
                  : (_) {
                      setState(() => _fields[field.key] = o.value);
                      _onFieldChanged(field.key, o.value);
                    },
            );
          }).toList(),
        ),
      ],
    );
  }

  List<Widget> _buildSnapshot(List<Map<String, dynamic>> snapshot) {
    final widgets = <Widget>[
      const MpSectionHeader(title: 'Submitted snapshot'),
    ];
    for (final section in snapshot) {
      widgets.add(
        MpCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                (section['title'] ?? 'Section').toString(),
                style: Theme.of(context).textTheme.titleSmall,
              ),
              ...asMapList(section['items']).map((item) {
                return Padding(
                  padding: const EdgeInsets.only(top: MpSpacing.xs),
                  child: Text(
                    '${item['label'] ?? item['code']}: ${item['value'] ?? ''}',
                  ),
                );
              }),
            ],
          ),
        ),
      );
      widgets.add(const SizedBox(height: MpSpacing.sm));
    }
    return widgets;
  }
}
