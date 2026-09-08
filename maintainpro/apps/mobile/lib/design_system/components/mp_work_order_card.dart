import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../tokens/spacing.dart';
import 'mp_card.dart';
import 'mp_status_chip.dart';
import 'mp_status_utils.dart';

/// Scannable work-order list card for Tasks and Work Orders modules.
class MpWorkOrderCard extends StatelessWidget {
  const MpWorkOrderCard({
    super.key,
    required this.title,
    required this.status,
    this.priority,
    this.assetName,
    this.vehicleName,
    this.assigneeName,
    this.dueDate,
    this.onTap,
  });

  final String title;
  final String status;
  final String? priority;
  final String? assetName;
  final String? vehicleName;
  final String? assigneeName;
  final DateTime? dueDate;
  final VoidCallback? onTap;

  bool get _isOverdue {
    if (dueDate == null) return false;
    final s = status.toUpperCase();
    if (s.contains('COMPLETE') || s.contains('CLOSED')) return false;
    return dueDate!.isBefore(DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final meta = <String>[
      if (assetName != null && assetName!.isNotEmpty) assetName!,
      if (vehicleName != null && vehicleName!.isNotEmpty) vehicleName!,
      if (assigneeName != null && assigneeName!.isNotEmpty) assigneeName!,
      if (dueDate != null)
        'Due ${DateFormat.MMMd().format(dueDate!)}${_isOverdue ? ' · Overdue' : ''}',
    ];

    return MpCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: theme.textTheme.titleMedium,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: MpSpacing.sm),
              MpStatusChip(
                label: MpStatusUtils.formatStatus(status),
                tone: MpStatusUtils.workOrderTone(status),
              ),
            ],
          ),
          if (priority != null && priority!.isNotEmpty) ...[
            const SizedBox(height: MpSpacing.sm),
            MpStatusChip(
              label: 'Priority ${MpStatusUtils.formatStatus(priority!)}',
              tone: MpStatusUtils.priorityTone(priority),
            ),
          ],
          if (meta.isNotEmpty) ...[
            const SizedBox(height: MpSpacing.sm),
            Text(
              meta.join(' · '),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.35,
              ),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}
