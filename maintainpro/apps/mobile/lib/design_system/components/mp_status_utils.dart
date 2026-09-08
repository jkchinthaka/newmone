import 'mp_status_chip.dart';

/// Maps domain status strings to consistent chip tones across modules.
abstract final class MpStatusUtils {
  static MpStatusTone workOrderTone(String status) {
    final s = status.toUpperCase();
    if (s.contains('COMPLETE') || s.contains('CLOSED') || s.contains('DONE')) {
      return MpStatusTone.success;
    }
    if (s.contains('PROGRESS') || s.contains('OPEN') || s.contains('ASSIGNED')) {
      return MpStatusTone.primary;
    }
    if (s.contains('HOLD') || s.contains('WAIT') || s.contains('REWORK') ||
        s.contains('PENDING')) {
      return MpStatusTone.warning;
    }
    if (s.contains('CANCEL') || s.contains('FAIL') || s.contains('OVERDUE') ||
        s.contains('CRITICAL')) {
      return MpStatusTone.error;
    }
    return MpStatusTone.neutral;
  }

  static String formatStatus(String raw) =>
      raw.replaceAll('_', ' ').trim();

  static MpStatusTone priorityTone(String? priority) {
    if (priority == null) return MpStatusTone.neutral;
    final p = priority.toUpperCase();
    if (p.contains('CRITICAL') || p.contains('HIGH')) return MpStatusTone.error;
    if (p.contains('MEDIUM')) return MpStatusTone.warning;
    return MpStatusTone.info;
  }
}
