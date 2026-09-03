import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/auth/auth_controller.dart';
import 'package:maintainpro_mobile/core/auth/auth_session.dart';
import 'package:maintainpro_mobile/core/auth/secure_token_store.dart';
import 'package:maintainpro_mobile/core/database/app_database.dart';
import 'package:maintainpro_mobile/core/network/dio_client.dart';
import 'package:maintainpro_mobile/core/offline/outbox_service.dart';
import 'package:maintainpro_mobile/core/offline/sync_controller.dart';
import 'package:maintainpro_mobile/core/tenant/tenant_context.dart';
import 'package:maintainpro_mobile/features/work_orders/data/evidence_upload_service.dart';

class _FixedAuthController extends AuthController {
  _FixedAuthController(super.ref, AuthState initial) {
    state = initial;
  }

  @override
  Future<void> bootstrap() async {}
}

class _ScriptedInterceptor extends Interceptor {
  _ScriptedInterceptor(this.handler);

  final Response<dynamic> Function(RequestOptions options) handler;
  int calls = 0;
  final seenKeys = <String>[];

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler h) {
    calls += 1;
    final key = options.headers['Idempotency-Key']?.toString();
    if (key != null) seenKeys.add(key);
    final response = handler(options);
    if ((response.statusCode ?? 200) >= 400) {
      h.reject(
        DioException(
          requestOptions: options,
          response: response,
          type: DioExceptionType.badResponse,
        ),
      );
      return;
    }
    h.resolve(response);
  }
}

class _NoopEvidence extends EvidenceUploadService {
  _NoopEvidence(super.ref);

  @override
  Future<List<PendingEvidenceDraft>> listAllPending() async => const [];

  @override
  Future<void> retryAllPending() async {}
}

void main() {
  late AppDatabase db;
  late OutboxService outbox;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    outbox = OutboxService(db);
  });

  tearDown(() async {
    await db.close();
  });

  AuthState authState({
    String userId = 'u1',
    String tenantId = 't1',
  }) {
    return AuthState(
      status: AuthStatus.authenticated,
      session: AuthSession(
        accessToken: 'access',
        refreshToken: 'refresh',
        user: AuthUser(
          id: userId,
          email: 'u@example.com',
          name: 'User',
          role: 'TECHNICIAN',
          tenantId: tenantId,
          permissions: const ['work_orders.manage'],
        ),
      ),
    );
  }

  ProviderContainer buildContainer({
    required Dio dio,
  }) {
    return ProviderContainer(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        outboxServiceProvider.overrideWithValue(outbox),
        dioProvider.overrideWithValue(dio),
        authControllerProvider.overrideWith(
          (ref) => _FixedAuthController(ref, authState()),
        ),
        tenantContextProvider.overrideWith(
          (ref) => TenantContextNotifier(ref.watch(secureTokenStoreProvider))
            ..state = const TenantContext(tenantId: 't1'),
        ),
        evidenceUploadServiceProvider.overrideWith(
          (ref) => _NoopEvidence(ref),
        ),
        syncControllerProvider.overrideWith(
          (ref) => SyncController(
            ref,
            checkConnectivity: () async => [ConnectivityResult.wifi],
            connectivityChanges: const Stream.empty(),
          ),
        ),
      ],
    );
  }

  group('OutboxService', () {
    test('enqueue survives restart-style reopen of same DB rows', () async {
      final id = await outbox.enqueue(
        tenantId: 't1',
        userId: 'u1',
        entityType: 'work_order',
        entityId: 'wo-1',
        operation: 'status',
        payload: {'id': 'wo-1', 'status': 'IN_PROGRESS'},
        idempotencyKey: 'idem-1',
      );
      final pending = await outbox.listPending(tenantId: 't1', userId: 'u1');
      expect(pending, hasLength(1));
      expect(pending.first.operationId, id);
      expect(pending.first.idempotencyKey, 'idem-1');
      expect(OutboxStateCodec.parse(pending.first.state), OutboxState.queued);
    });

    test('enqueueIfAbsent dedupes duplicate tap payloads', () async {
      final a = await outbox.enqueueIfAbsent(
        tenantId: 't1',
        userId: 'u1',
        entityType: 'work_order',
        entityId: 'wo-1',
        operation: 'status',
        payload: {'id': 'wo-1', 'status': 'IN_PROGRESS'},
      );
      final b = await outbox.enqueueIfAbsent(
        tenantId: 't1',
        userId: 'u1',
        entityType: 'work_order',
        entityId: 'wo-1',
        operation: 'status',
        payload: {'id': 'wo-1', 'status': 'IN_PROGRESS'},
      );
      expect(a, b);
      final pending = await outbox.listPending(tenantId: 't1', userId: 'u1');
      expect(pending, hasLength(1));
    });

    test('tenant isolation keeps other tenant outbox invisible', () async {
      await outbox.enqueue(
        tenantId: 't1',
        userId: 'u1',
        entityType: 'work_order',
        operation: 'note',
        payload: {'note': 'a'},
        entityId: 'wo-1',
      );
      await outbox.enqueue(
        tenantId: 't2',
        userId: 'u1',
        entityType: 'work_order',
        operation: 'note',
        payload: {'note': 'b'},
        entityId: 'wo-1',
      );
      final t1 = await outbox.listPending(tenantId: 't1', userId: 'u1');
      final t2 = await outbox.listPending(tenantId: 't2', userId: 'u1');
      expect(t1, hasLength(1));
      expect(t2, hasLength(1));
      expect(jsonDecode(t1.first.payloadJson)['note'], 'a');
      expect(jsonDecode(t2.first.payloadJson)['note'], 'b');
    });
  });

  group('SyncController drain', () {
    test('reconnect drain marks status synced with idempotency key', () async {
      final interceptor = _ScriptedInterceptor((o) {
        expect(o.method, 'PATCH');
        expect(o.path, '/work-orders/wo-1/status');
        return Response(
          requestOptions: o,
          statusCode: 200,
          data: {
            'success': true,
            'data': {'id': 'wo-1', 'status': 'IN_PROGRESS'},
          },
        );
      });
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
      dio.interceptors.add(interceptor);

      await outbox.enqueue(
        tenantId: 't1',
        userId: 'u1',
        entityType: 'work_order',
        entityId: 'wo-1',
        operation: 'status',
        payload: {'id': 'wo-1', 'status': 'IN_PROGRESS'},
        idempotencyKey: 'status-key-1',
      );

      final container = buildContainer(dio: dio);
      addTearDown(container.dispose);
      await container.read(syncControllerProvider.notifier).syncNow();

      expect(interceptor.calls, 1);
      expect(interceptor.seenKeys, ['status-key-1']);
      expect(await outbox.listPending(tenantId: 't1', userId: 'u1'), isEmpty);
      final all = await outbox.listAll(tenantId: 't1', userId: 'u1');
      expect(OutboxStateCodec.parse(all.first.state), OutboxState.synced);
    });

    test('4xx permanent failure stops retries', () async {
      final interceptor = _ScriptedInterceptor(
        (o) => Response(
          requestOptions: o,
          statusCode: 400,
          data: {
            'success': false,
            'error': {'code': 'VALIDATION', 'message': 'invalid status'},
          },
        ),
      );
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
      dio.interceptors.add(interceptor);

      await outbox.enqueue(
        tenantId: 't1',
        userId: 'u1',
        entityType: 'work_order',
        entityId: 'wo-1',
        operation: 'status',
        payload: {'id': 'wo-1', 'status': 'NOPE'},
      );

      final container = buildContainer(dio: dio);
      addTearDown(container.dispose);
      await container.read(syncControllerProvider.notifier).syncNow();

      final all = await outbox.listAll(tenantId: 't1', userId: 'u1');
      expect(
        OutboxStateCodec.parse(all.first.state),
        OutboxState.failedPermanent,
      );
      expect(await outbox.listPending(tenantId: 't1', userId: 'u1'), isEmpty);
    });

    test('5xx remains retryable and keeps pending', () async {
      final interceptor = _ScriptedInterceptor(
        (o) => Response(
          requestOptions: o,
          statusCode: 503,
          data: {
            'success': false,
            'error': {'message': 'unavailable'},
          },
        ),
      );
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
      dio.interceptors.add(interceptor);

      await outbox.enqueue(
        tenantId: 't1',
        userId: 'u1',
        entityType: 'work_order',
        entityId: 'wo-1',
        operation: 'note',
        payload: {'workOrderId': 'wo-1', 'note': 'field note'},
        idempotencyKey: 'note-1',
      );

      final container = buildContainer(dio: dio);
      addTearDown(container.dispose);
      await container.read(syncControllerProvider.notifier).syncNow();

      final pending = await outbox.listPending(tenantId: 't1', userId: 'u1');
      expect(pending, hasLength(1));
      expect(
        OutboxStateCodec.parse(pending.first.state),
        OutboxState.failedRetryable,
      );
      expect(pending.first.attempts, 1);
    });

    test('repeat syncNow does not duplicate successful note writes', () async {
      final interceptor = _ScriptedInterceptor(
        (o) => Response(
          requestOptions: o,
          statusCode: 200,
          data: {'success': true, 'data': {}},
        ),
      );
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
      dio.interceptors.add(interceptor);

      await outbox.enqueue(
        tenantId: 't1',
        userId: 'u1',
        entityType: 'work_order',
        entityId: 'wo-1',
        operation: 'note',
        payload: {'workOrderId': 'wo-1', 'note': 'once'},
        idempotencyKey: 'note-once',
      );

      final container = buildContainer(dio: dio);
      addTearDown(container.dispose);
      final sync = container.read(syncControllerProvider.notifier);
      await sync.syncNow();
      await sync.syncNow();
      expect(interceptor.calls, 1);
      expect(interceptor.seenKeys, ['note-once']);
    });
  });
}
