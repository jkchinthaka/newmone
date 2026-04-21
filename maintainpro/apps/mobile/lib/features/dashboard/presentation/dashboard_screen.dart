import 'package:flutter/material.dart';

import '../../../shared/models/app_user.dart';
import '../../assets/presentation/asset_scanner_screen.dart';
import '../../cleaning/presentation/cleaning_screen.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../work_orders/presentation/work_orders_screen.dart';

class _NavItem {
  const _NavItem(
      {required this.label, required this.icon, required this.builder});

  final String label;
  final IconData icon;
  final Widget Function(AppUser user) builder;
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.user});

  final AppUser user;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _index = 0;

  List<_NavItem> _itemsForRole(UserRole role) {
    final cleaningTab = _NavItem(
      label: 'Cleaning',
      icon: Icons.cleaning_services_outlined,
      builder: (user) => CleaningScreen(user: user),
    );
    final workOrdersTab = _NavItem(
      label: 'Work Orders',
      icon: Icons.assignment_outlined,
      builder: (user) => WorkOrdersScreen(role: user.role),
    );
    final assetsTab = _NavItem(
      label: 'Assets',
      icon: Icons.qr_code_scanner_outlined,
      builder: (_) => const AssetScannerScreen(),
    );
    final notificationsTab = _NavItem(
      label: 'Alerts',
      icon: Icons.notifications_outlined,
      builder: (_) => const NotificationsScreen(),
    );
    final profileTab = _NavItem(
      label: 'Profile',
      icon: Icons.person_outline,
      builder: (user) => ProfileScreen(user: user),
    );

    switch (role) {
      case UserRole.cleaner:
        return [cleaningTab, notificationsTab, profileTab];
      case UserRole.supervisor:
        return [cleaningTab, workOrdersTab, notificationsTab, profileTab];
      case UserRole.driver:
        return [workOrdersTab, notificationsTab, profileTab];
      case UserRole.mechanic:
      case UserRole.technician:
        return [workOrdersTab, assetsTab, notificationsTab, profileTab];
      default:
        return [
          workOrdersTab,
          assetsTab,
          cleaningTab,
          notificationsTab,
          profileTab,
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.user.role;
    final items = _itemsForRole(role);
    final safeIndex = _index.clamp(0, items.length - 1);

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
      body: items[safeIndex].builder(widget.user),
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: items
            .map((i) =>
                NavigationDestination(icon: Icon(i.icon), label: i.label))
            .toList(),
      ),
    );
  }
}
