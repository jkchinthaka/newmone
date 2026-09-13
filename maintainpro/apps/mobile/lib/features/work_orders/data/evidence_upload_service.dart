import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/database/app_database.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/offline/outbox_service.dart';
import '../../../core/tenant/tenant_context.dart';
import 'work_orders_repository.dart';

/// Pending local evidence draft (OutboxService entityType `WorkOrderEvidence`).
class PendingEvidenceDraft {
  const PendingEvidenceDraft({
    required this.draftId,
    required this.workOrderId,
    required this.clientGeneratedId,
    required this.localFilePath,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    required this.evidenceType,
    required this.state,
    this.note,
    this.lastError,
  });

  final String draftId;
  final String workOrderId;
  final String clientGeneratedId;
  final String localFilePath;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String evidenceType;
  final String state;
  final String? note;
  final String? lastError;

  factory PendingEvidenceDraft.fromDraft(LocalDraft draft) {
    final map = jsonDecode(draft.payloadJson);
    final payload =
        map is Map ? Map<String, dynamic>.from(map) : <String, dynamic>{};
    return PendingEvidenceDraft(
      draftId: draft.draftId,
      workOrderId: (payload['workOrderId'] ?? draft.entityId ?? '').toString(),
      clientGeneratedId:
          (payload['clientGeneratedId'] ?? draft.draftId).toString(),
      localFilePath: (payload['localFilePath'] ?? '').toString(),
      fileName: (payload['fileName'] ?? 'evidence.jpg').toString(),
      mimeType: (payload['mimeType'] ?? 'image/jpeg').toString(),
      sizeBytes: int.tryParse('${payload['sizeBytes'] ?? 0}') ?? 0,
      evidenceType: (payload['evidenceType'] ?? 'BEFORE_PHOTO').toString(),
      state: (payload['state'] ?? 'pending').toString(),
      note: payload['note']?.toString(),
      lastError: payload['lastError']?.toString(),
    );
  }
}

/// Pick → compress → persist locally → upload-request → optional PUT → confirm.
///
/// Server Idempotency-Key is not wired on evidence upload yet; we rely on
/// [clientGeneratedId] dedupe on the Nest evidence service. Double-tap is
/// guarded client-side via [InFlightGuard].
class EvidenceUploadService {
  EvidenceUploadService(this._ref);

  final Ref _ref;
  final _picker = ImagePicker();
  final _uuid = const Uuid();
  final _guard = InFlightGuard();

  WorkOrdersRepository get _repo => _ref.read(workOrdersRepositoryProvider);
  OutboxService get _outbox => _ref.read(outboxServiceProvider);

  bool get isBusy => _guard.isBusy;

  Future<bool> _isOnline() async {
    final results = await Connectivity().checkConnectivity();
    return results.any((r) => r != ConnectivityResult.none);
  }

  Future<Directory> _pendingDir() async {
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(docs.path, 'pending_evidence'));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  Future<List<PendingEvidenceDraft>> listAllPending() async {
    final auth = _ref.read(authControllerProvider);
    final tenantId =
        _ref.read(tenantContextProvider).tenantId ?? auth.user?.tenantId ?? '';
    final userId = auth.user?.id ?? '';
    if (tenantId.isEmpty || userId.isEmpty) return const [];

    final drafts = await _outbox.listDrafts(
      tenantId: tenantId,
      userId: userId,
    );
    return drafts
        .where((d) => d.entityType == 'WorkOrderEvidence')
        .map(PendingEvidenceDraft.fromDraft)
        .where((d) => d.state != 'synced')
        .toList();
  }

  Future<List<PendingEvidenceDraft>> listPendingForWorkOrder(
    String workOrderId,
  ) async {
    final all = await listAllPending();
    return all.where((d) => d.workOrderId == workOrderId).toList();
  }

  /// Retries all pending evidence drafts sequentially (reconnect / Sync Center).
  Future<void> retryAllPending() async {
    final pending = await listAllPending();
    for (final draft in pending) {
      await retryPending(draft);
    }
  }

  /// Camera or gallery pick with compression, then upload or queue offline.
  Future<EvidenceUploadOutcome> captureAndUpload({
    required String workOrderId,
    required ImageSource source,
    String evidenceType = 'BEFORE_PHOTO',
    String? note,
  }) {
    return _guard.run(() async {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 75,
      );
      if (picked == null) {
        return const EvidenceUploadOutcome.cancelled();
      }

      final clientGeneratedId = _uuid.v4();
      final bytes = await picked.readAsBytes();
      final mime = _guessMime(picked.path, picked.mimeType);
      final fileName = p.basename(picked.path).isEmpty
          ? 'evidence_$clientGeneratedId.jpg'
          : p.basename(picked.path);

      final pendingDir = await _pendingDir();
      final localPath = p.join(
        pendingDir.path,
        '$clientGeneratedId${p.extension(fileName).isEmpty ? '.jpg' : p.extension(fileName)}',
      );
      final localFile = File(localPath);
      await localFile.writeAsBytes(bytes, flush: true);

      await _persistDraft(
        draftId: clientGeneratedId,
        workOrderId: workOrderId,
        clientGeneratedId: clientGeneratedId,
        localFilePath: localPath,
        fileName: fileName,
        mimeType: mime,
        sizeBytes: bytes.length,
        evidenceType: evidenceType,
        note: note,
        state: 'pending',
      );

      final online = await _isOnline();
      if (!online) {
        return EvidenceUploadOutcome.queued(
          clientGeneratedId: clientGeneratedId,
        );
      }

      try {
        await _uploadPipeline(
          workOrderId: workOrderId,
          clientGeneratedId: clientGeneratedId,
          localFilePath: localPath,
          fileName: fileName,
          mimeType: mime,
          sizeBytes: bytes.length,
          evidenceType: evidenceType,
          note: note,
          source: 'MOBILE',
          draftId: clientGeneratedId,
        );
        return EvidenceUploadOutcome.uploaded(
          clientGeneratedId: clientGeneratedId,
        );
      } on ApiException catch (e) {
        await _persistDraft(
          draftId: clientGeneratedId,
          workOrderId: workOrderId,
          clientGeneratedId: clientGeneratedId,
          localFilePath: localPath,
          fileName: fileName,
          mimeType: mime,
          sizeBytes: bytes.length,
          evidenceType: evidenceType,
          note: note,
          state: 'failed',
          lastError: e.message,
        );
        return EvidenceUploadOutcome.failed(
          clientGeneratedId: clientGeneratedId,
          message: e.message,
        );
      }
    }).then(
      (value) => value ?? const EvidenceUploadOutcome.inFlight(),
    );
  }

  Future<EvidenceUploadOutcome> retryPending(PendingEvidenceDraft draft) {
    return _guard.run(() async {
      final file = File(draft.localFilePath);
      if (!await file.exists()) {
        return EvidenceUploadOutcome.failed(
          clientGeneratedId: draft.clientGeneratedId,
          message: 'Local evidence file missing',
        );
      }

      await _persistDraft(
        draftId: draft.draftId,
        workOrderId: draft.workOrderId,
        clientGeneratedId: draft.clientGeneratedId,
        localFilePath: draft.localFilePath,
        fileName: draft.fileName,
        mimeType: draft.mimeType,
        sizeBytes: draft.sizeBytes,
        evidenceType: draft.evidenceType,
        note: draft.note,
        state: 'syncing',
      );

      try {
        await _uploadPipeline(
          workOrderId: draft.workOrderId,
          clientGeneratedId: draft.clientGeneratedId,
          localFilePath: draft.localFilePath,
          fileName: draft.fileName,
          mimeType: draft.mimeType,
          sizeBytes: draft.sizeBytes,
          evidenceType: draft.evidenceType,
          note: draft.note,
          source: 'OFFLINE_SYNC',
          draftId: draft.draftId,
        );
        return EvidenceUploadOutcome.uploaded(
          clientGeneratedId: draft.clientGeneratedId,
        );
      } on ApiException catch (e) {
        await _persistDraft(
          draftId: draft.draftId,
          workOrderId: draft.workOrderId,
          clientGeneratedId: draft.clientGeneratedId,
          localFilePath: draft.localFilePath,
          fileName: draft.fileName,
          mimeType: draft.mimeType,
          sizeBytes: draft.sizeBytes,
          evidenceType: draft.evidenceType,
          note: draft.note,
          state: 'failed',
          lastError: e.message,
        );
        return EvidenceUploadOutcome.failed(
          clientGeneratedId: draft.clientGeneratedId,
          message: e.message,
        );
      }
    }).then(
      (value) => value ?? const EvidenceUploadOutcome.inFlight(),
    );
  }

  Future<void> _uploadPipeline({
    required String workOrderId,
    required String clientGeneratedId,
    required String localFilePath,
    required String fileName,
    required String mimeType,
    required int sizeBytes,
    required String evidenceType,
    required String source,
    required String draftId,
    String? note,
  }) async {
    final request = await _repo.requestEvidenceUpload(
      workOrderId: workOrderId,
      fileName: fileName,
      mimeType: mimeType,
      sizeBytes: sizeBytes,
      evidenceType: evidenceType,
      note: note,
      clientGeneratedId: clientGeneratedId,
      source: source,
    );

    if (!request.ok || request.attachmentId == null) {
      throw BadRequestException(
        request.message.isEmpty
            ? 'Evidence upload is not available'
            : request.message,
      );
    }

    final bytes = await File(localFilePath).readAsBytes();
    // When uploadUrl is null (mock / metadata-only mode), skip bytes PUT and
    // confirm immediately — same as web WorkOrderEvidencePanel.
    await _repo.uploadBytesIfNeeded(
      uploadUrl: request.uploadUrl,
      bytes: bytes,
      mimeType: mimeType,
    );

    await _repo.confirmEvidenceUpload(
      workOrderId: workOrderId,
      attachmentId: request.attachmentId!,
    );

    // Delete local file ONLY after confirm succeeds.
    try {
      final f = File(localFilePath);
      if (await f.exists()) await f.delete();
    } catch (_) {
      // Non-fatal: draft still cleared below.
    }

    await _outbox.deleteDraft(draftId);
  }

  Future<void> _persistDraft({
    required String draftId,
    required String workOrderId,
    required String clientGeneratedId,
    required String localFilePath,
    required String fileName,
    required String mimeType,
    required int sizeBytes,
    required String evidenceType,
    required String state,
    String? note,
    String? lastError,
  }) async {
    final auth = _ref.read(authControllerProvider);
    final tenantId = _ref.read(tenantContextProvider).tenantId ??
        auth.user?.tenantId ??
        'unknown';
    final userId = auth.user?.id ?? 'unknown';

    await _outbox.saveDraft(
      draftId: draftId,
      tenantId: tenantId,
      userId: userId,
      entityType: 'WorkOrderEvidence',
      entityId: workOrderId,
      title: 'Evidence $evidenceType',
      payload: {
        'workOrderId': workOrderId,
        'clientGeneratedId': clientGeneratedId,
        'localFilePath': localFilePath,
        'fileName': fileName,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes,
        'evidenceType': evidenceType,
        if (note != null) 'note': note,
        'state': state,
        if (lastError != null) 'lastError': lastError,
      },
    );
  }

  String _guessMime(String path, String? pickerMime) {
    if (pickerMime != null && pickerMime.isNotEmpty) return pickerMime;
    final ext = p.extension(path).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.heic':
        return 'image/heic';
      default:
        return 'image/jpeg';
    }
  }
}

enum EvidenceUploadStatus {
  cancelled,
  inFlight,
  queued,
  uploaded,
  failed,
}

class EvidenceUploadOutcome {
  const EvidenceUploadOutcome._({
    required this.status,
    this.clientGeneratedId,
    this.message,
  });

  const EvidenceUploadOutcome.cancelled()
      : this._(status: EvidenceUploadStatus.cancelled);

  const EvidenceUploadOutcome.inFlight()
      : this._(status: EvidenceUploadStatus.inFlight);

  const EvidenceUploadOutcome.queued({required String clientGeneratedId})
      : this._(
          status: EvidenceUploadStatus.queued,
          clientGeneratedId: clientGeneratedId,
        );

  const EvidenceUploadOutcome.uploaded({required String clientGeneratedId})
      : this._(
          status: EvidenceUploadStatus.uploaded,
          clientGeneratedId: clientGeneratedId,
        );

  const EvidenceUploadOutcome.failed({
    required String clientGeneratedId,
    required String message,
  }) : this._(
          status: EvidenceUploadStatus.failed,
          clientGeneratedId: clientGeneratedId,
          message: message,
        );

  final EvidenceUploadStatus status;
  final String? clientGeneratedId;
  final String? message;
}

final evidenceUploadServiceProvider = Provider<EvidenceUploadService>((ref) {
  return EvidenceUploadService(ref);
});
