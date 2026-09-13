import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/features/assets/assets_list_screen.dart';
import 'package:maintainpro_mobile/features/assets/data/assets_api_client.dart';
import 'package:maintainpro_mobile/features/assets/pm_schedules_screen.dart';

class _FixedSyncController extends SyncController {
  _FixedSyncController(super.ref, SyncStatus initial) {
    state = initial;
  }

  @override
  Future<void> syncNow() async {}

  @override
  Future<void> refreshCounts() async {}
}

class _ScriptedInterceptor extends Interceptor {
  _ScriptedInterceptor(this.scripts);

  final Map<String, Response<dynamic> Function(RequestOptions)> scripts;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    for (final entry in scripts.entries) {
      if (options.path.contains(entry.key)) {
        final res = entry.value(options);
        if (res.statusCode != null && res.statusCode! >= 400) {
          handler.reject(
            DioException(
              requestOptions: options,
              response: res,
              type: DioExceptionType.badResponse,
            ),
          );
          return;
        }
        handler.resolve(res);
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

List<Override> _overrides(Dio dio) => [
      dioProvider.overrideWithValue(dio),
      assetsApiClientProvider.overrideWithValue(AssetsApiClient(dio)),
      syncControllerProvider.overrideWith(
        (ref) => _FixedSyncController(
          ref,
          const SyncStatus(phase: SyncPhase.idle),
        ),
      ),
    ];

void main() {
  testWidgets('assets list shows empty state', (tester) async {
    final dio = _dio({
      '/assets': (_) => Response(
            requestOptions: RequestOptions(path: '/assets'),
            data: {
              'data': [],
              'meta': {'page': 1, 'limit': 20, 'total': 0, 'totalPages': 1},
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(dio),
        child: const MaterialApp(home: AssetsListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No assets found'), findsOneWidget);
  });

  testWidgets('assets list shows 403 message', (tester) async {
    final dio = _dio({
      '/assets': (_) => Response(
            requestOptions: RequestOptions(path: '/assets'),
            data: {
              'error': {'message': 'Forbidden', 'code': 'FORBIDDEN'},
            },
            statusCode: 403,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(dio),
        child: const MaterialApp(home: AssetsListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Forbidden'), findsWidgets);
  });

  testWidgets('PM schedules filters overdue', (tester) async {
    final past =
        DateTime.now().subtract(const Duration(days: 3)).toIso8601String();
    final future =
        DateTime.now().add(const Duration(days: 10)).toIso8601String();
    final dio = _dio({
      '/maintenance/schedules': (_) => Response(
            requestOptions: RequestOptions(path: '/maintenance/schedules'),
            data: {
              'data': [
                {
                  'id': '1',
                  'type': 'PREVENTIVE',
                  'isActive': true,
                  'title': 'Belt check',
                  'nextDueDate': past,
                  'asset': {'id': 'a1', 'assetTag': 'A-1', 'name': 'Press'},
                },
                {
                  'id': '2',
                  'type': 'INSPECTION',
                  'isActive': true,
                  'title': 'Later',
                  'nextDueDate': future,
                },
              ],
            },
            statusCode: 200,
          ),
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(dio),
        child: const MaterialApp(home: PmSchedulesScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Belt check'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, 'Overdue'));
    await tester.pumpAndSettle();
    expect(find.text('Belt check'), findsOneWidget);
    expect(find.text('Later'), findsNothing);
  });
}
