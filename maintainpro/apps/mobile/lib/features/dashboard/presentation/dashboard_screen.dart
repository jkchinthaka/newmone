import 'package:flutter/material.dart';

import '../../../shared/models/app_user.dart';
import '../../assets/presentation/asset_scanner_screen.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../work_orders/presentation/work_orders_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.role});

  final UserRole role;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      WorkOrdersScreen(role: widget.role),
      const AssetScannerScreen(),
      const NotificationsScreen(),
      ProfileScreen(role: widget.role),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text('MaintainPro - ${widget.role.name.toUpperCase()}'),
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
