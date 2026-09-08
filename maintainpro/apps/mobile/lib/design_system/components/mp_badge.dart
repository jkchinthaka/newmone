import 'package:flutter/material.dart';

/// Numeric or text badge overlaid on icons / tabs.
class MpBadge extends StatelessWidget {
  const MpBadge({
    super.key,
    required this.child,
    this.count,
    this.show = true,
  });

  final Widget child;
  final int? count;
  final bool show;

  @override
  Widget build(BuildContext context) {
    if (!show || (count != null && count! <= 0)) return child;
    final label = count == null
        ? null
        : (count! > 99 ? '99+' : '$count');
    return Badge(
      label: label == null ? null : Text(label),
      isLabelVisible: true,
      child: child,
    );
  }
}
