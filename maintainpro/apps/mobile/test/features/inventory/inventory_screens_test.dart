import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/features/inventory/data/inventory_api_client.dart';
import 'package:maintainpro_mobile/features/inventory/inventory_hub_screen.dart';
import 'package:maintainpro_mobile/features/inventory/parts_list_screen.dart';
import 'package:maintainpro_mobile/features/work_orders/presentation/work_orders_list_screen.dart';

class _FixedSyncController extends SyncController {
  _FixedSyncController(super.ref, SyncStatus initial) {
    state = initial;
  }

  @override
  Future<void> syncNow() async {}

  @override
  Future<void> refreshCounts() async {}
}

class _FixedAuthController extends AuthController {
  _FixedAuthController(super.ref, AuthState initial) {
    state = initial;
  }

  @override
  Future<void> bootstrap() async {}
}

class _ScriptedInterceptor extends Interceptor {
  _ScriptedInterceptor(this.scripts);

  final Map<String, Response<dynamic> Function(RequestOptions)> scripts;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    for (final entry in scripts.entries) {
      if (options.path.contains(entry.key)) {
        handler.resolve(entry.value(options));
        return;
      }
    }
    handler.reject(
      DioException(
        requestOptions: options,
        error: 'unscripted ${options.path}',
        type: DioExceptionType.unknown,
      ),
    );
  }
}

Dio _dio(Map<String, Response<dynamic> Function(RequestOptions)> scripts) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test/api'));
  dio.interceptors.add(_ScriptedInterceptor(scripts));
  return dio;
}

AuthState _auth({
  required List<String> permissions,
  String role = 'ADMIN',
}) {
  return AuthState(
    status: AuthStatus.authenticated,
    session: AuthSession(
      accessToken: 't',
      refreshToken: 'r',
      user: AuthUser(
        id: 'u1',
        email: 'admin@test.local',
        name: 'Admin',
        role: role,
        tenantId: 't1',
        permissions: permissions,
      ),
    ),
  );
}

List<Override> _baseOverrides(
  Dio dio, {
  required AuthState auth,
}) =>
    [
      dioProvider.overrideWithValue(dio),
      inventoryApiClientProvider.overrideWithValue(InventoryApiClient(dio)),
      syncControllerProvider.overrideWith(
        (ref) => _FixedSyncController(
          ref,
          const SyncStatus(phase: SyncPhase.idle),
        ),
      ),
      authControllerProvider.overrideWith(
        (ref) => _FixedAuthController(ref, auth),
      ),
    ];

void main() {
  testWidgets('parts list shows server stock', (tester) async {
    final dio = _dio({
      '/inventory/parts': (_) => Response(
            requestOptions: RequestOptions(path: '/inventory/parts'),
            data: {
              'data': [
                {
                  'id': 'p1',
                  'partNumber': 'SP-2001',
                  'name': 'Filter',
                  'category': 'Engine',
                  'quantityInStock': 4,
                  'availableQuantity': 3,
                  'minimumStock': 5,
                  'reorderPoint': 2,
                  'unitCost': 10,
                },
              ],
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          dio,
          auth: _auth(permissions: const ['inventory.manage']),
        ),
        child: const MaterialApp(home: PartsListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Filter'), findsOneWidget);
    expect(find.textContaining('Available 3'), findsOneWidget);
  });

  testWidgets('inventory hub blocked without inventory.manage', (tester) async {
    final dio = _dio({});

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          dio,
          auth: _auth(permissions: const [], role: 'VIEWER'),
        ),
        child: const MaterialApp(home: InventoryHubScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('inventory.manage'), findsWidgets);
  });

  testWidgets('work orders list passes assetId query', (tester) async {
    final dio = _dio({
      '/work-orders': (options) {
        expect(options.queryParameters['assetId'], 'asset-abc');
        return Response(
          requestOptions: options,
          data: {
            'data': [
              {
                'id': 'wo1',
                'title': 'Asset WO',
                'status': 'OPEN',
              },
            ],
          },
          statusCode: 200,
        );
      },
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dioProvider.overrideWithValue(dio),
          syncControllerProvider.overrideWith(
            (ref) => _FixedSyncController(
              ref,
              const SyncStatus(phase: SyncPhase.idle),
            ),
          ),
        ],
        child: const MaterialApp(
          home: WorkOrdersListScreen(
            initialAssetId: 'asset-abc',
            assetFilterLabel: 'AST-1001',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Asset filter: AST-1001'), findsOneWidget);
    expect(find.text('Asset WO'), findsOneWidget);
  });
}
