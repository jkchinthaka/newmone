import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import 'mp_card.dart';

/// Executive KPI tile for dashboards and reports.
class MpKpiCard extends StatelessWidget {
  const MpKpiCard({
    super.key,
    required this.label,
    required this.value,
    this.subLabel,
    this.trend,
  });

  final String label;
  final String value;
  final String? subLabel;
  final String? trend;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return MpCard(
      padding: const EdgeInsets.all(MpSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const Spacer(),
          Text(
            value,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (subLabel != null || trend != null) ...[
            const SizedBox(height: MpSpacing.xs),
            Text(
              [
                if (subLabel != null) subLabel!,
                if (trend != null) trend!,
              ].join(' · '),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}
