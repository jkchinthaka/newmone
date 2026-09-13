import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/database/app_database.dart';
import '../../../core/offline/outbox_service.dart';
import '../../../core/tenant/tenant_context.dart';
import 'fg_models.dart';

/// Local CL30 drafts via [OutboxService.saveDraft] entityType `FgCl30Draft`.
///
/// Never sets businessDate from the device as authoritative — only optional
/// [FgCl30DraftPayload.displayDate] for UI.
class Cl30DraftStore {
  Cl30DraftStore(this._outbox);

  final OutboxService _outbox;
  static const entityType = 'FgCl30Draft';
  static const _uuid = Uuid();

  Future<String> save({
    required String tenantId,
    required String userId,
    required Map<String, dynamic> fields,
    required String occurrenceToken,
    String? localDraftId,
    String? vehicleId,
    String? recordId,
    int? draftVersion,
    String? displayDate,
    String? title,
  }) async {
    final id = localDraftId ?? _uuid.v4();
    final payload = FgCl30DraftPayload(
      fields: fields,
      occurrenceToken: occurrenceToken,
      localDraftId: id,
      vehicleId: vehicleId,
      recordId: recordId,
      draftVersion: draftVersion,
      displayDate: displayDate,
      title: title,
    );
    await _outbox.saveDraft(
      tenantId: tenantId,
      userId: userId,
      entityType: entityType,
      draftId: id,
      entityId: recordId,
      title: title ?? 'CL30 draft',
      payload: payload.toJson(),
    );
    return id;
  }

  Future<List<LocalDraft>> list({
    required String tenantId,
    required String userId,
  }) async {
    final all = await _outbox.listDrafts(tenantId: tenantId, userId: userId);
    return all.where((d) => d.entityType == entityType).toList();
  }

  FgCl30DraftPayload? parsePayload(LocalDraft draft) {
    try {
      final map = jsonDecode(draft.payloadJson);
      if (map is Map) {
        return FgCl30DraftPayload.fromJson(Map<String, dynamic>.from(map));
      }
    } catch (_) {}
    return null;
  }

  Future<void> delete(String draftId) => _outbox.deleteDraft(draftId);
}

final cl30DraftStoreProvider = Provider<Cl30DraftStore>((ref) {
  return Cl30DraftStore(ref.watch(outboxServiceProvider));
});

/// Scoped drafts for the active tenant/user; null when unauthenticated.
final cl30DraftsListProvider =
    FutureProvider.autoDispose<List<LocalDraft>>((ref) async {
  final auth = ref.watch(authControllerProvider);
  final tenant = ref.watch(tenantContextProvider);
  final user = auth.user;
  if (user == null || !tenant.hasTenant) return const [];
  return ref.watch(cl30DraftStoreProvider).list(
        tenantId: tenant.tenantId!,
        userId: user.id,
      );
});
