import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final entries = [
      {
        'title': 'WO-2026-0004 status changed',
        'time': '5m ago',
        'unread': true
      },
      {'title': 'Utility bill due in 7 days', 'time': '1h ago', 'unread': true},
      {
        'title': 'Vehicle V-212 geofence alert',
        'time': '4h ago',
        'unread': false
      },
    ];

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: entries.length,
      itemBuilder: (context, index) {
        final item = entries[index];
        final unread = item['unread'] == true;

        return Card(
          color: unread
              ? Theme.of(context)
                  .colorScheme
                  .primaryContainer
                  .withValues(alpha: 0.25)
              : null,
          child: ListTile(
            leading: Icon(unread
                ? Icons.mark_email_unread_outlined
                : Icons.drafts_outlined),
            title: Text(item['title'] as String),
            subtitle: Text(item['time'] as String),
          ),
        );
      },
    );
  }
}
