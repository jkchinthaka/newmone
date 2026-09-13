import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/features/fleet/data/fleet_api_client.dart';
import 'package:maintainpro_mobile/features/fleet/vehicles_list_screen.dart';

class _FixedSyncController extends SyncController {
  _FixedSyncController(super.ref, SyncStatus initial) {
    state = initial;
  }

  @override
  Future<void> syncNow() async {}

  @override
  Future<void> refreshCounts() async {}
}

Dio _emptyListDio() {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: {
              'success': true,
              'data': {
                'items': <dynamic>[],
                'pagination': {
                  'page': 1,
                  'pageSize': 20,
                  'total': 0,
                  'totalPages': 1,
                  'hasNextPage': false,
                },
              },
            },
          ),
        );
      },
    ),
  );
  return dio;
}

void main() {
  testWidgets('vehicles list shows empty state', (tester) async {
    final dio = _emptyListDio();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dioProvider.overrideWithValue(dio),
          fleetApiClientProvider.overrideWithValue(FleetApiClient(dio)),
          syncControllerProvider.overrideWith(
            (ref) => _FixedSyncController(
              ref,
              const SyncStatus(phase: SyncPhase.idle),
            ),
          ),
        ],
        child: const MaterialApp(home: VehiclesListScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No vehicles'), findsOneWidget);
    expect(find.text('Vehicles'), findsWidgets);
  });

  testWidgets('vehicles list shows loading then empty', (tester) async {
    final completer = Completer<Response<dynamic>>();
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          completer.future.then((response) {
            handler.resolve(response);
          });
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dioProvider.overrideWithValue(dio),
          fleetApiClientProvider.overrideWithValue(FleetApiClient(dio)),
          syncControllerProvider.overrideWith(
            (ref) => _FixedSyncController(
              ref,
              const SyncStatus(phase: SyncPhase.idle),
            ),
          ),
        ],
        child: const MaterialApp(home: VehiclesListScreen()),
      ),
    );
    await tester.pump();
    expect(find.text('Loading vehicles…'), findsOneWidget);

    completer.complete(
      Response(
        requestOptions: RequestOptions(path: '/vehicles'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'items': <dynamic>[],
            'pagination': {
              'page': 1,
              'pageSize': 20,
              'total': 0,
              'totalPages': 1,
              'hasNextPage': false,
            },
          },
        },
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No vehicles'), findsOneWidget);
  });

  testWidgets('vehicles list offline without cache shows message',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          syncControllerProvider.overrideWith(
            (ref) => _FixedSyncController(
              ref,
              const SyncStatus(phase: SyncPhase.offline),
            ),
          ),
        ],
        child: const MaterialApp(home: VehiclesListScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Vehicles require connection'),
      findsWidgets,
    );
  });
}
