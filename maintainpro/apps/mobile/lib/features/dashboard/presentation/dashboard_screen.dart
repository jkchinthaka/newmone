import 'package:flutter/material.dart';

import '../../../shared/models/app_user.dart';
import '../../assets/presentation/asset_scanner_screen.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../work_orders/presentation/work_orders_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.user});

  final AppUser user;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final role = widget.user.role;

    final pages = [
      WorkOrdersScreen(role: role),
      const AssetScannerScreen(),
      const NotificationsScreen(),
      ProfileScreen(user: widget.user),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('MaintainPro - ${role.name.toUpperCase()}'),
            Text(
              widget.user.displayName,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) {
          setState(() => _index = value);
        },
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.assignment_outlined), label: 'Work Orders'),
          NavigationDestination(
              icon: Icon(Icons.qr_code_scanner_outlined), label: 'Assets'),
          NavigationDestination(
              icon: Icon(Icons.notifications_outlined), label: 'Notifications'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}
