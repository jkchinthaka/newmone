import 'package:firebase_core/firebase_core.dart';
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
  await _tryInitFirebase();

  runApp(
    const ProviderScope(
      child: MaintainProApp(),
    ),
  );
}

Future<void> _tryInitFirebase() async {
  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp();
    }
  } catch (_) {
    // Push registration skips when Firebase is not configured.
  }
}