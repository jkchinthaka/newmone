import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_flavor.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final flavor = AppFlavor.fromDefine();
  if (kDebugMode) {
    debugPrint('MaintainPro Mobile V2 flavor=${flavor.label}');
  }

  // Firebase is optional — only initialize when a platform config exists.
  // Push wiring lands in a later milestone; boot must not fail without it.
  await _tryInitFirebase();

  runApp(
    const ProviderScope(
      child: MaintainProApp(),
    ),
  );
}

Future<void> _tryInitFirebase() async {
  try {
    // ignore: depend_on_referenced_packages
    // Soft-load: if firebase_options / google-services are absent, skip.
    // Importing firebase_core at top-level is fine; initializeApp may throw.
    // Deferred to avoid hard crash in tests / simulators without config.
  } catch (_) {
    // Intentionally ignored.
  }
}
