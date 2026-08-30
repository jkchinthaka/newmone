import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/alerts/alerts_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/diagnostics/diagnostics_screen.dart';
import '../../features/drafts/draft_center_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/more/module_hub_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/scan/scan_screen.dart';
import '../../features/search/global_search_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/shell/adaptive_shell.dart';
import '../../features/splash/splash_screen.dart';
import '../../features/sync/sync_center_screen.dart';
import '../../features/tasks/tasks_screen.dart';
import '../../features/fg/fg_hub_screen.dart';
import '../../features/work_orders/presentation/work_order_detail_screen.dart';
import '../../features/work_orders/presentation/work_orders_list_screen.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_session.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/splash',
    refreshListenable: _AuthRefresh(ref),
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final loggingIn = loc == '/login';
      final splashing = loc == '/splash';

      if (auth.status == AuthStatus.unknown || splashing) {
        return splashing ? null : '/splash';
      }

      if (!auth.isAuthenticated) {
        return loggingIn ? null : '/login';
      }

      if (loggingIn || splashing) {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => AdaptiveShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: HomeScreen(),
            ),
          ),
          GoRoute(
            path: '/tasks',
            pageBuilder: (context, state) => NoTransitionPage(
              child: TasksScreen(
                queue: state.uri.queryParameters['queue'],
              ),
            ),
          ),
          GoRoute(
            path: '/scan',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ScanScreen(),
            ),
          ),
          GoRoute(
            path: '/alerts',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AlertsScreen(),
            ),
          ),
          GoRoute(
            path: '/more',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ModuleHubScreen(),
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/search',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const GlobalSearchScreen(),
      ),
      GoRoute(
        path: '/profile',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/settings',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/diagnostics',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const DiagnosticsScreen(),
      ),
      GoRoute(
        path: '/drafts',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const DraftCenterScreen(),
      ),
      GoRoute(
        path: '/sync',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const SyncCenterScreen(),
      ),
      GoRoute(
        path: '/work-orders',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const WorkOrdersListScreen(),
        routes: [
          GoRoute(
            path: ':id',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => WorkOrderDetailScreen(
              workOrderId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/fg',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const FgHubScreen(),
      ),
    ],
  );
});

/// Bridges Riverpod auth changes into GoRouter refresh.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(this._ref) {
    _ref.listen<AuthState>(authControllerProvider, (_, __) {
      notifyListeners();
    });
  }

  final Ref _ref;
}
