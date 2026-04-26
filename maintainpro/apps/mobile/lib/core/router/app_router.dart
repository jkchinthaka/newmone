import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/assets/presentation/asset_detail_screen.dart';
import '../../features/assets/presentation/asset_scanner_screen.dart';
import '../../features/assets/presentation/assets_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/cleaning/presentation/cleaning_hub_screen.dart';
import '../../features/cleaning/presentation/cleaning_location_detail_screen.dart';
import '../../features/cleaning/presentation/cleaning_locations_screen.dart';
import '../../features/cleaning/presentation/cleaning_scan_screen.dart';
import '../../features/cleaning/presentation/cleaning_visit_detail_screen.dart';
import '../../features/cleaning/presentation/cleaning_visits_screen.dart';
import '../../features/cleaning/presentation/facility_issues_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/fleet/presentation/driver_detail_screen.dart';
import '../../features/fleet/presentation/drivers_screen.dart';
import '../../features/fleet/presentation/fleet_alerts_screen.dart';
import '../../features/fleet/presentation/fleet_hub_screen.dart';
import '../../features/fleet/presentation/fleet_map_screen.dart';
import '../../features/fleet/presentation/fuel_logs_screen.dart';
import '../../features/fleet/presentation/trip_detail_screen.dart';
import '../../features/fleet/presentation/trips_screen.dart';
import '../../features/fleet/presentation/vehicle_detail_screen.dart';
import '../../features/fleet/presentation/vehicles_screen.dart';
import '../../features/notifications/data/datasources/notifications_socket.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/work_orders/presentation/work_order_create_screen.dart';
import '../../features/work_orders/presentation/work_order_detail_screen.dart';
import '../../features/work_orders/presentation/work_orders_screen.dart';
import '../widgets/glass_bottom_nav.dart';
import '../widgets/placeholder_screen.dart';

/// Top-level go_router instance. All app routes are registered here.
/// Real screens will replace `PlaceholderScreen` calls in later phases.
final GoRouter appRouter = GoRouter(
  initialLocation: '/splash',
  debugLogDiagnostics: false,
  routes: <RouteBase>[
    GoRoute(
      path: '/splash',
      builder: (_, __) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (_, __) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      builder: (_, __) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/forgot-password',
      builder: (_, __) => const ForgotPasswordScreen(),
    ),

    // Shell with bottom nav
    ShellRoute(
      builder: (_, __, child) => _BottomNavShell(child: child),
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (_, __) => const DashboardScreen(),
        ),
        GoRoute(
          path: '/work-orders',
          builder: (_, __) => const WorkOrdersScreen(),
          routes: [
            GoRoute(
              path: 'create',
              builder: (_, __) => const WorkOrderCreateScreen(),
            ),
            GoRoute(
              path: ':id',
              builder: (_, state) =>
                  WorkOrderDetailScreen(id: state.pathParameters['id'] ?? ''),
            ),
          ],
        ),
        GoRoute(
          path: '/scan',
          redirect: (_, __) => '/assets/scan',
        ),
        GoRoute(
          path: '/notifications',
          builder: (_, __) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, __) => const ProfileScreen(),
          routes: [
            GoRoute(
              path: 'edit',
              builder: (_, __) =>
                  const PlaceholderScreen(title: 'Edit Profile'),
            ),
          ],
        ),
      ],
    ),

    // Full-screen (no bottom nav) routes
    GoRoute(
      path: '/assets',
      builder: (_, __) => const AssetsScreen(),
      routes: [
        GoRoute(
          path: 'scan',
          builder: (_, __) => const AssetScannerScreen(),
        ),
        GoRoute(
          path: ':id',
          builder: (_, state) =>
              AssetDetailScreen(id: state.pathParameters['id'] ?? ''),
        ),
      ],
    ),
    GoRoute(
      path: '/maintenance',
      builder: (_, __) => const PlaceholderScreen(title: 'Maintenance'),
      routes: [
        GoRoute(
          path: ':id',
          builder: (_, state) => PlaceholderScreen(
              title: 'Maintenance ${state.pathParameters['id']}'),
        ),
      ],
    ),
    GoRoute(
      path: '/fleet',
      builder: (_, __) => const FleetHubScreen(),
      routes: [
        GoRoute(
          path: 'vehicles',
          builder: (_, __) => const VehiclesScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => VehicleDetailScreen(
                  vehicleId: state.pathParameters['id'] ?? ''),
            ),
          ],
        ),
        GoRoute(
          path: 'drivers',
          builder: (_, __) => const DriversScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => DriverDetailScreen(
                  driverId: state.pathParameters['id'] ?? ''),
            ),
          ],
        ),
        GoRoute(
          path: 'map',
          builder: (_, __) => const FleetMapScreen(),
        ),
        GoRoute(
          path: 'fuel',
          builder: (_, __) => const FuelLogsScreen(),
        ),
        GoRoute(
          path: 'trips',
          builder: (_, __) => const TripsScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) =>
                  TripDetailScreen(tripId: state.pathParameters['id'] ?? ''),
            ),
          ],
        ),
        GoRoute(
          path: 'alerts',
          builder: (_, __) => const FleetAlertsScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/inventory',
      builder: (_, __) => const PlaceholderScreen(title: 'Inventory'),
      routes: [
        GoRoute(
          path: ':id',
          builder: (_, state) => PlaceholderScreen(
              title: 'Spare Part ${state.pathParameters['id']}'),
        ),
      ],
    ),
    GoRoute(
      path: '/cleaning',
      builder: (_, __) => const CleaningHubScreen(),
      routes: [
        GoRoute(
          path: 'locations',
          builder: (_, __) => const CleaningLocationsScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => CleaningLocationDetailScreen(
                  id: state.pathParameters['id'] ?? ''),
            ),
          ],
        ),
        GoRoute(
          path: 'scan',
          builder: (_, __) => const CleaningScanScreen(),
        ),
        GoRoute(
          path: 'visits',
          builder: (_, state) => CleaningVisitsScreen(
            initialStatus: state.uri.queryParameters['status'],
          ),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => CleaningVisitDetailScreen(
                  id: state.pathParameters['id'] ?? ''),
            ),
          ],
        ),
        GoRoute(
          path: 'issues',
          builder: (_, __) => const FacilityIssuesScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/farm',
      builder: (_, __) => const PlaceholderScreen(title: 'Farm'),
      routes: [
        GoRoute(
          path: 'fields',
          builder: (_, __) => const PlaceholderScreen(title: 'Fields'),
        ),
        GoRoute(
          path: 'crops',
          builder: (_, __) => const PlaceholderScreen(title: 'Crops'),
        ),
        GoRoute(
          path: 'harvest',
          builder: (_, __) => const PlaceholderScreen(title: 'Harvest'),
        ),
        GoRoute(
          path: 'livestock',
          builder: (_, __) => const PlaceholderScreen(title: 'Livestock'),
        ),
        GoRoute(
          path: 'irrigation',
          builder: (_, __) => const PlaceholderScreen(title: 'Irrigation'),
        ),
        GoRoute(
          path: 'spray',
          builder: (_, __) => const PlaceholderScreen(title: 'Spray Logs'),
        ),
      ],
    ),
    GoRoute(
      path: '/utilities',
      builder: (_, __) => const PlaceholderScreen(title: 'Utilities'),
      routes: [
        GoRoute(
          path: ':id',
          builder: (_, state) =>
              PlaceholderScreen(title: 'Meter ${state.pathParameters['id']}'),
        ),
      ],
    ),
    GoRoute(
      path: '/suppliers',
      builder: (_, __) => const PlaceholderScreen(title: 'Suppliers'),
      routes: [
        GoRoute(
          path: 'orders',
          builder: (_, __) => const PlaceholderScreen(title: 'Purchase Orders'),
        ),
        GoRoute(
          path: ':id',
          builder: (_, state) => PlaceholderScreen(
              title: 'Supplier ${state.pathParameters['id']}'),
        ),
      ],
    ),
    GoRoute(
      path: '/reports',
      builder: (_, __) => const PlaceholderScreen(title: 'Reports'),
    ),
    GoRoute(
      path: '/billing',
      builder: (_, __) => const PlaceholderScreen(title: 'Billing'),
    ),
    GoRoute(
      path: '/settings',
      builder: (_, __) => const PlaceholderScreen(title: 'Settings'),
    ),
  ],
);

/// Bottom nav shell used by the inner ShellRoute, with a glassmorphism nav bar.
class _BottomNavShell extends ConsumerWidget {
  const _BottomNavShell({required this.child});
  final Widget child;

  static const List<
          ({String path, IconData icon, IconData activeIcon, String label})>
      _tabs = [
    (
      path: '/dashboard',
      icon: Icons.dashboard_outlined,
      activeIcon: Icons.dashboard_rounded,
      label: 'Home'
    ),
    (
      path: '/work-orders',
      icon: Icons.assignment_outlined,
      activeIcon: Icons.assignment_rounded,
      label: 'Orders'
    ),
    (
      path: '/scan',
      icon: Icons.qr_code_scanner_outlined,
      activeIcon: Icons.qr_code_scanner_rounded,
      label: 'Scan'
    ),
    (
      path: '/notifications',
      icon: Icons.notifications_outlined,
      activeIcon: Icons.notifications_rounded,
      label: 'Alerts'
    ),
    (
      path: '/profile',
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
      label: 'Profile'
    ),
  ];

  int _indexFor(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Activate the notifications socket lifecycle (auto-connects on auth).
    ref.watch(notificationsSocketProvider);
    final location = GoRouterState.of(context).uri.toString();
    final currentIndex = _indexFor(location);
    return Scaffold(
      extendBody: true,
      body: child,
      bottomNavigationBar: GlassBottomNav(
        currentIndex: currentIndex,
        onTap: (i) => context.go(_tabs[i].path),
        items: [
          for (final t in _tabs)
            GlassNavItem(
                icon: t.icon, activeIcon: t.activeIcon, label: t.label),
        ],
      ),
    );
  }
}
