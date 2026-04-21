import 'package:flutter/material.dart';

import '../../../shared/models/app_user.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, required this.role});

  final UserRole role;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
            title: const Text('Platform User'),
            subtitle: Text('Role: ${role.name.toUpperCase()}'),
          ),
        ),
        const SizedBox(height: 8),
        const Card(
          child: ListTile(
            title: Text('Offline Sync'),
            subtitle:
                Text('14 pending updates queued for next network reconnect.'),
            trailing: Icon(Icons.sync_outlined),
          ),
        ),
        const SizedBox(height: 8),
        const Card(
          child: ListTile(
            title: Text('Security'),
            subtitle: Text('Biometric unlock and token rotation enabled.'),
            trailing: Icon(Icons.security_outlined),
          ),
        ),
      ],
    );
  }
}
