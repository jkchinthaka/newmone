import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/app_strings.dart';
import '../../design_system/tokens/spacing.dart';

/// Phone: NavigationBar. Tablet / wide: NavigationRail.
class AdaptiveShell extends StatelessWidget {
  const AdaptiveShell({super.key, required this.child});

  final Widget child;

  static const _tabs = [
    _TabSpec('/home', Icons.home_outlined, Icons.home, AppStrings.navHome),
    _TabSpec('/tasks', Icons.task_alt_outlined, Icons.task_alt, AppStrings.navTasks),
    _TabSpec(
      '/scan',
      Icons.qr_code_scanner_outlined,
      Icons.qr_code_scanner,
      AppStrings.navScan,
    ),
    _TabSpec(
      '/alerts',
      Icons.notifications_outlined,
      Icons.notifications,
      AppStrings.navAlerts,
    ),
    _TabSpec('/more', Icons.grid_view_outlined, Icons.grid_view, AppStrings.navMore),
  ];

  int _indexForLocation(String location) {
    final idx = _tabs.indexWhere((t) => location.startsWith(t.path));
    return idx < 0 ? 0 : idx;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final index = _indexForLocation(location);
    final width = MediaQuery.sizeOf(context).width;
    final useRail = width >= 800;

    if (useRail) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: index,
              onDestinationSelected: (i) => context.go(_tabs[i].path),
              labelType: NavigationRailLabelType.all,
              destinations: [
                for (final tab in _tabs)
                  NavigationRailDestination(
                    icon: Icon(tab.icon),
                    selectedIcon: Icon(tab.selectedIcon),
                    label: Text(tab.label),
                  ),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: child),
          ],
        ),
      );
    }

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: [
          for (final tab in _tabs)
            NavigationDestination(
              icon: Icon(tab.icon),
              selectedIcon: Icon(tab.selectedIcon),
              label: tab.label,
            ),
        ],
      ),
    );
  }
}

class _TabSpec {
  const _TabSpec(this.path, this.icon, this.selectedIcon, this.label);
  final String path;
  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

/// Shared app bar actions for shell screens.
List<Widget> shellActions(BuildContext context) {
  return [
    IconButton(
      tooltip: AppStrings.searchTitle,
      onPressed: () => context.push('/search'),
      icon: const Icon(Icons.search),
    ),
    IconButton(
      tooltip: AppStrings.profileTitle,
      onPressed: () => context.push('/profile'),
      icon: const Icon(Icons.person_outline),
    ),
    const SizedBox(width: MpSpacing.xs),
  ];
}
