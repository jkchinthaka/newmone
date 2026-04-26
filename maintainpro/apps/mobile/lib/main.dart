import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';

/// Top-level Firebase background message handler. Registered with
/// FirebaseMessaging.onBackgroundMessage during app startup. Must be a
/// top-level (or static) function annotated with @pragma('vm:entry-point').
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(dynamic message) async {
  // Real handling lives in the notifications feature (Phase 11).
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Local storage
  await Hive.initFlutter();
  await Future.wait<void>([
    Hive.openBox<dynamic>('workOrdersBox'),
    Hive.openBox<dynamic>('assetsBox'),
    Hive.openBox<dynamic>('notificationsBox'),
    Hive.openBox<dynamic>('offlineQueueBox'),
    Hive.openBox<dynamic>('dashboardBox'),
    Hive.openBox<dynamic>('settingsBox'),
  ]);

  // Firebase init is deferred to Phase 11 once google-services config lands.

  runApp(const ProviderScope(child: MaintainProApp()));
}
