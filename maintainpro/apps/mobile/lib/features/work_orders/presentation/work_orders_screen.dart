import 'package:flutter/material.dart';

import '../../../shared/models/app_user.dart';

class WorkOrdersScreen extends StatelessWidget {
  const WorkOrdersScreen({super.key, required this.role});

  final UserRole role;

  @override
  Widget build(BuildContext context) {
    final workOrders = [
      {
        'code': 'WO-2026-0001',
        'title': 'Boiler vibration inspection',
        'status': 'OPEN'
      },
      {
        'code': 'WO-2026-0004',
        'title': 'Forklift brake adjustment',
        'status': 'IN_PROGRESS'
      },
      {
        'code': 'WO-2026-0008',
        'title': 'Compressor filter replacement',
        'status': 'ON_HOLD'
      },
    ];

    final canReassign = role == UserRole.superAdmin ||
        role == UserRole.admin ||
        role == UserRole.manager;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              canReassign
                  ? 'You can reassign and prioritize work orders.'
                  : 'You can update status and submit completion notes.',
            ),
          ),
        ),
        const SizedBox(height: 12),
        ...workOrders.map(
          (order) => Card(
            child: ListTile(
              title: Text(order['title']!),
              subtitle: Text(order['code']!),
              trailing: Chip(label: Text(order['status']!)),
            ),
          ),
        ),
      ],
    );
  }
}
