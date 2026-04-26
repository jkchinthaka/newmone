import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
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
          builder: (_, __) => const PlaceholderScreen(title: 'Dashboard'),
        ),
        GoRoute(
          path: '/work-orders',
          builder: (_, __) => const PlaceholderScreen(title: 'Work Orders'),
          routes: [
            GoRoute(
              path: 'create',
              builder: (_, __) =>
                  const PlaceholderScreen(title: 'Create Work Order'),
            ),
            GoRoute(
              path: ':id',
              builder: (_, state) => PlaceholderScreen(
                  title: 'Work Order ${state.pathParameters['id']}'),
            ),
          ],
        ),
        GoRoute(
          path: '/scan',
          builder: (_, __) => const PlaceholderScreen(title: 'Scan'),
        ),
        GoRoute(
          path: '/notifications',
          builder: (_, __) => const PlaceholderScreen(title: 'Notifications'),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, __) => const PlaceholderScreen(title: 'Profile'),
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
      builder: (_, __) => const PlaceholderScreen(title: 'Assets'),
      routes: [
        GoRoute(
          path: 'scan',
          builder: (_, __) => const PlaceholderScreen(title: 'Asset Scanner'),
        ),
        GoRoute(
          path: ':id',
          builder: (_, state) =>
              PlaceholderScreen(title: 'Asset ${state.pathParameters['id']}'),
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
      builder: (_, __) => const PlaceholderScreen(title: 'Fleet'),
      routes: [
        GoRoute(
          path: 'vehicles/:id',
          builder: (_, state) =>
              PlaceholderScreen(title: 'Vehicle ${state.pathParameters['id']}'),
        ),
        GoRoute(
          path: 'drivers',
          builder: (_, __) => const PlaceholderScreen(title: 'Drivers'),
        ),
        GoRoute(
          path: 'map',
          builder: (_, __) => const PlaceholderScreen(title: 'Fleet Map'),
        ),
        GoRoute(
          path: 'fuel',
          builder: (_, __) => const PlaceholderScreen(title: 'Fuel Logs'),
        ),
        GoRoute(
          path: 'trips',
          builder: (_, __) => const PlaceholderScreen(title: 'Trip Logs'),
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
      builder: (_, __) => const PlaceholderScreen(title: 'Cleaning'),
      routes: [
        GoRoute(
          path: 'locations',
          builder: (_, __) =>
              const PlaceholderScreen(title: 'Cleaning Locations'),
        ),
        GoRoute(
          path: 'scan',
          builder: (_, __) => const PlaceholderScreen(title: 'Cleaning Scan'),
        ),
        GoRoute(
          path: 'visits',
          builder: (_, __) => const PlaceholderScreen(title: 'Cleaning Visits'),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => PlaceholderScreen(
                  title: 'Visit ${state.pathParameters['id']}'),
            ),
          ],
        ),
        GoRoute(
          path: 'issues',
          builder: (_, __) => const PlaceholderScreen(title: 'Facility Issues'),
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

/// Bottom nav shell used by the inner ShellRoute. Will be expanded with
/// a real glassmorphism nav bar in Phase 3.
class _BottomNavShell extends StatelessWidget {
  const _BottomNavShell({required this.child});
  final Widget child;

  static const List<({String path, IconData icon, String label})> _tabs = [
    (path: '/dashboard', icon: Icons.dashboard_rounded, label: 'Home'),
    (path: '/work-orders', icon: Icons.assignment_rounded, label: 'Orders'),
    (path: '/scan', icon: Icons.qr_code_scanner_rounded, label: 'Scan'),
    (
      path: '/notifications',
      icon: Icons.notifications_rounded,
      label: 'Alerts'
    ),
    (path: '/profile', icon: Icons.person_rounded, label: 'Profile'),
  ];

  int _indexFor(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final currentIndex = _indexFor(location);
    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: (i) => context.go(_tabs[i].path),
        items: [
          for (final t in _tabs)
            BottomNavigationBarItem(icon: Icon(t.icon), label: t.label),
        ],
      ),
    );
  }
}
