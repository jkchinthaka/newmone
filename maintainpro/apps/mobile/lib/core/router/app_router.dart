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
import '../../features/fg/cl30_drafts_screen.dart';
import '../../features/fg/cl30_history_screen.dart';
import '../../features/fg/cl30_qa_detail_screen.dart';
import '../../features/fg/cl30_qa_queue_screen.dart';
import '../../features/fg/cl30_recorder_screen.dart';
import '../../features/fg/cl30_supervisor_detail_screen.dart';
import '../../features/fg/cl30_supervisor_queue_screen.dart';
import '../../features/fg/fg_hub_screen.dart';
import '../../features/facilities/cleaning_locations_screen.dart';
import '../../features/facilities/cleaning_visits_list_screen.dart';
import '../../features/facilities/facilities_hub_screen.dart';
import '../../features/facilities/facility_issue_detail_screen.dart';
import '../../features/facilities/facility_issue_report_screen.dart';
import '../../features/facilities/facility_issues_list_screen.dart';
import '../../features/facilities/facility_room_detail_screen.dart';
import '../../features/facilities/facility_rooms_list_screen.dart';
import '../../features/facilities/utilities_meters_screen.dart';
import '../../features/facilities/utility_meter_detail_screen.dart';
import '../../features/inventory/erp_status_screen.dart';
import '../../features/inventory/inventory_hub_screen.dart';
import '../../features/inventory/low_stock_screen.dart';
import '../../features/inventory/part_detail_screen.dart';
import '../../features/inventory/parts_list_screen.dart';
import '../../features/inventory/part_requests_list_screen.dart';
import '../../features/inventory/purchase_order_detail_screen.dart';
import '../../features/inventory/purchase_orders_list_screen.dart';
import '../../features/inventory/supplier_detail_screen.dart';
import '../../features/inventory/suppliers_list_screen.dart';
import '../../features/inventory/warehouse_balances_screen.dart';
import '../../features/inventory/warehouses_screen.dart';
import '../../features/assets/asset_detail_screen.dart';
import '../../features/assets/assets_hub_screen.dart';
import '../../features/assets/assets_list_screen.dart';
import '../../features/assets/job_codes_list_screen.dart';
import '../../features/assets/pm_schedules_screen.dart';
import '../../features/fleet/driver_detail_screen.dart';
import '../../features/fleet/drivers_list_screen.dart';
import '../../features/fleet/fleet_hub_screen.dart';
import '../../features/fleet/fuel_log_form_screen.dart';
import '../../features/fleet/meter_reading_form_screen.dart';
import '../../features/fleet/trip_end_screen.dart';
import '../../features/fleet/trip_start_screen.dart';
import '../../features/fleet/vehicle_detail_screen.dart';
import '../../features/fleet/vehicles_list_screen.dart';
import '../../features/gate/gate_home_screen.dart';
import '../../features/gate/gate_in_screen.dart';
import '../../features/gate/gate_out_screen.dart';
import '../../features/gate/gate_vehicle_screen.dart';
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

      // Stay on splash only while auth status is still resolving.
      if (auth.status == AuthStatus.unknown) {
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
        builder: (context, state) => WorkOrdersListScreen(
          initialQueue: state.uri.queryParameters['queue'],
          initialAssetId: state.uri.queryParameters['assetId'],
          assetFilterLabel: state.uri.queryParameters['assetTag'],
        ),
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
        path: '/fleet',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const FleetHubScreen(),
        routes: [
          GoRoute(
            path: 'vehicles',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const VehiclesListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => VehicleDetailScreen(
                  vehicleId: state.pathParameters['id']!,
                ),
                routes: [
                  GoRoute(
                    path: 'trip-start',
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) => TripStartScreen(
                      vehicleId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'trip-end',
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) => TripEndScreen(
                      vehicleId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'fuel',
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) => FuelLogFormScreen(
                      vehicleId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'meter',
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) => MeterReadingFormScreen(
                      vehicleId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          GoRoute(
            path: 'drivers',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const DriversListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => DriverDetailScreen(
                  driverId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/gate',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const GateHomeScreen(),
        routes: [
          GoRoute(
            path: 'vehicle/:id',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => GateVehicleScreen(
              vehicleId: state.pathParameters['id']!,
            ),
            routes: [
              GoRoute(
                path: 'out',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => GateOutScreen(
                  vehicleId: state.pathParameters['id']!,
                ),
              ),
              GoRoute(
                path: 'in',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => GateInScreen(
                  vehicleId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/assets',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const AssetsHubScreen(),
        routes: [
          GoRoute(
            path: 'list',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) {
              final cat = state.uri.queryParameters['category'];
              final serviceFocus =
                  state.uri.queryParameters['serviceFocus'] == '1';
              return AssetsListScreen(
                initialCategory: cat,
                serviceFocus: serviceFocus,
              );
            },
          ),
          GoRoute(
            path: 'pm',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const PmSchedulesScreen(),
          ),
          GoRoute(
            path: 'job-codes',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const JobCodesListScreen(),
          ),
          GoRoute(
            path: ':id',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => AssetDetailScreen(
              assetId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/inventory',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const InventoryHubScreen(),
        routes: [
          GoRoute(
            path: 'parts',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const PartsListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => PartDetailScreen(
                  partId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'low-stock',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const LowStockScreen(),
          ),
          GoRoute(
            path: 'warehouses',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const WarehousesScreen(),
          ),
          GoRoute(
            path: 'suppliers',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const SuppliersListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => SupplierDetailScreen(
                  supplierId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'purchase-orders',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const PurchaseOrdersListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => PurchaseOrderDetailScreen(
                  purchaseOrderId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'warehouse-balances',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const WarehouseBalancesScreen(),
          ),
          GoRoute(
            path: 'part-requests',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const PartRequestsListScreen(),
          ),
          GoRoute(
            path: 'erp',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const ErpStatusScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/facilities',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const FacilitiesHubScreen(),
        routes: [
          GoRoute(
            path: 'rooms',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const FacilityRoomsListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => FacilityRoomDetailScreen(
                  roomId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'issues',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const FacilityIssuesListScreen(),
            routes: [
              GoRoute(
                path: 'report',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) {
                  final q = state.uri.queryParameters;
                  return FacilityIssueReportScreen(
                    draftId: q['draftId'],
                    roomId: q['roomId'],
                    roomLabel: q['roomLabel'],
                  );
                },
              ),
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => FacilityIssueDetailScreen(
                  issueId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'cleaning',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const CleaningLocationsScreen(),
            routes: [
              GoRoute(
                path: 'visits',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const CleaningVisitsListScreen(),
              ),
            ],
          ),
          GoRoute(
            path: 'utilities',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const UtilitiesMetersScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => UtilityMeterDetailScreen(
                  meterId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/fg',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const FgHubScreen(),
        routes: [
          GoRoute(
            path: 'cl30/new',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) {
              final extra = state.extra;
              String? draftId;
              if (extra is Map && extra['draftId'] != null) {
                draftId = extra['draftId'].toString();
              }
              return Cl30RecorderScreen(resumeDraftId: draftId);
            },
          ),
          GoRoute(
            path: 'cl30/drafts',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const Cl30DraftsScreen(),
          ),
          GoRoute(
            path: 'cl30/records/:id',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) {
              final extra = state.extra;
              String? draftId;
              if (extra is Map && extra['draftId'] != null) {
                draftId = extra['draftId'].toString();
              }
              return Cl30RecorderScreen(
                recordId: state.pathParameters['id'],
                resumeDraftId: draftId,
              );
            },
          ),
          GoRoute(
            path: 'reviews',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const Cl30SupervisorQueueScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => Cl30SupervisorDetailScreen(
                  submissionId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'qa',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const Cl30QaQueueScreen(),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => Cl30QaDetailScreen(
                  submissionId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'history',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const Cl30HistoryScreen(),
          ),
        ],
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
