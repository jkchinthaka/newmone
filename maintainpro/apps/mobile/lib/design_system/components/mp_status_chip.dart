import 'package:flutter/material.dart';

import '../tokens/colors.dart';
import '../tokens/radius.dart';
import '../tokens/spacing.dart';

enum MpStatusTone { neutral, success, warning, error, info, primary }

/// Compact status pill for work-order / sync states.
class MpStatusChip extends StatelessWidget {
  const MpStatusChip({
    super.key,
    required this.label,
    this.tone = MpStatusTone.neutral,
  });

  final String label;
  final MpStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (bg, fg) = switch (tone) {
      MpStatusTone.success => (
          MpColors.success.withValues(alpha: 0.12),
          MpColors.success,
        ),
      MpStatusTone.warning => (
          MpColors.warning.withValues(alpha: 0.12),
          MpColors.warning,
        ),
      MpStatusTone.error => (
          MpColors.error.withValues(alpha: 0.12),
          MpColors.error,
        ),
      MpStatusTone.info => (
          MpColors.info.withValues(alpha: 0.12),
          MpColors.info,
        ),
      MpStatusTone.primary => (
          scheme.primary.withValues(alpha: 0.12),
          scheme.primary,
        ),
      MpStatusTone.neutral => (
          scheme.surfaceContainerHighest,
          scheme.onSurfaceVariant,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: MpSpacing.sm,
        vertical: MpSpacing.xxs + 1,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: MpRadius.smAll,
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}
