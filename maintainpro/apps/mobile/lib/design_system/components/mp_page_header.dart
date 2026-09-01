import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import 'mp_status_chip.dart';

/// Consistent page intro: title, subtitle, optional role/context badge.
class MpPageHeader extends StatelessWidget {
  const MpPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.badge,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final String? badge;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: MpSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.headlineSmall),
                if (subtitle != null) ...[
                  const SizedBox(height: MpSpacing.xs),
                  Text(
                    subtitle!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      height: 1.45,
                    ),
                  ),
                ],
                if (badge != null) ...[
                  const SizedBox(height: MpSpacing.sm),
                  MpStatusChip(label: badge!, tone: MpStatusTone.primary),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
