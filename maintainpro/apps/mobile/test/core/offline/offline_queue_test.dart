import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:maintainpro_mobile/core/offline/offline_queue.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  late OfflineQueue queue;

  Future<void> resetBox() async {
    if (Hive.isBoxOpen('offlineQueueBox')) {
      await Hive.box<dynamic>('offlineQueueBox').deleteFromDisk();
    } else {
      await Hive.deleteBoxFromDisk('offlineQueueBox');
    }
  }

  setUpAll(() async {
    tempDir = await Directory.systemTemp.createTemp('maintainpro-offline-queue-test');
    Hive.init(tempDir.path);
  });

  setUp(() async {
    await resetBox();
    queue = OfflineQueue();
  });

  tearDownAll(() async {
    await Hive.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test('deduplicates queued actions by dedupe key', () async {
    final first = await queue.add(
      kind: 'FUEL_LOG_CREATE',
      path: '/vehicles/veh-1/fuel-logs',
      method: 'POST',
      payload: {'liters': 40},
      dedupeKey: 'fuel-veh-1-40',
    );

    final duplicate = await queue.add(
      kind: 'FUEL_LOG_CREATE',
      path: '/vehicles/veh-1/fuel-logs',
      method: 'POST',
      payload: {'liters': 40},
      dedupeKey: 'fuel-veh-1-40',
    );

    final actions = await queue.list();

    expect(duplicate.id, first.id);
    expect(actions, hasLength(1));
  });

  test('marks replay failures and preserves the queued action for retry', () async {
    final action = await queue.add(
      kind: 'WORK_ORDER_STATUS_UPDATE',
      path: '/work-orders/wo-1/status',
      method: 'PATCH',
      payload: {'status': 'IN_PROGRESS'},
      dedupeKey: 'wo-1-IN_PROGRESS',
    );

    final replayed = await queue.replay((_) async {
      throw StateError('network down');
    });

    final failed = await queue.getById(action.id);

    expect(replayed, isEmpty);
    expect(failed, isNotNull);
    expect(failed!.status, OfflineActionStatus.failed);
    expect(failed.attempts, 1);
    expect(failed.lastError, contains('network down'));
  });
}