import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/models/app_user.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
            title: Text(user.displayName),
            subtitle:
                Text('${user.email}\nRole: ${user.role.name.toUpperCase()}'),
            isThreeLine: true,
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
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () {
            ref.read(authStateProvider.notifier).logout();
          },
          icon: const Icon(Icons.logout),
          label: const Text('Sign Out'),
        ),
      ],
    );
  }
}
