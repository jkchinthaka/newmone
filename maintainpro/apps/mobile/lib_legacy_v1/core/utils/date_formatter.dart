import 'package:intl/intl.dart';

class DateFormatter {
  DateFormatter._();

  static final DateFormat _shortDate = DateFormat('MMM d, y');
  static final DateFormat _longDate = DateFormat('EEE, MMM d, y');
  static final DateFormat _time = DateFormat('h:mm a');
  static final DateFormat _dateTime = DateFormat('MMM d, y · h:mm a');
  static final DateFormat _iso = DateFormat("yyyy-MM-dd'T'HH:mm:ss");

  static String shortDate(DateTime? date) =>
      date == null ? '—' : _shortDate.format(date.toLocal());

  static String longDate(DateTime? date) =>
      date == null ? '—' : _longDate.format(date.toLocal());

  static String time(DateTime? date) =>
      date == null ? '—' : _time.format(date.toLocal());

  static String dateTime(DateTime? date) =>
      date == null ? '—' : _dateTime.format(date.toLocal());

  static String iso(DateTime date) => _iso.format(date.toUtc());

  /// "5 minutes ago", "2 hours ago", "yesterday"…
  static String relative(DateTime? date) {
    if (date == null) return '—';
    final now = DateTime.now();
    final diff = now.difference(date.toLocal());
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
    if (diff.inDays < 365) return '${(diff.inDays / 30).floor()}mo ago';
    return '${(diff.inDays / 365).floor()}y ago';
  }

  /// Counts down to `deadline`. Returns "OVERDUE" if past.
  static String countdown(DateTime? deadline) {
    if (deadline == null) return '—';
    final diff = deadline.toLocal().difference(DateTime.now());
    if (diff.isNegative) return 'OVERDUE';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m left';
    if (diff.inHours < 24) {
      final h = diff.inHours;
      final m = diff.inMinutes % 60;
      return '${h}h ${m}m';
    }
    return '${diff.inDays}d ${diff.inHours % 24}h';
  }

  static bool isWithinHours(DateTime? deadline, int hours) {
    if (deadline == null) return false;
    final diff = deadline.toLocal().difference(DateTime.now());
    return !diff.isNegative && diff.inHours < hours;
  }
}
