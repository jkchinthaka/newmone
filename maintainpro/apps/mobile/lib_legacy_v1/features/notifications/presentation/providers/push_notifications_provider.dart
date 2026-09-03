import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/push_notifications_remote_datasource.dart';

final pushNotificationsRemoteProvider =
    Provider<PushNotificationsRemoteDataSource>((ref) {
  return PushNotificationsRemoteDataSource(ref.watch(dioProvider));
});

final pushNotificationsServiceProvider = Provider<PushNotificationsService>((ref) {
  final service = PushNotificationsService(ref.watch(pushNotificationsRemoteProvider));
  ref.onDispose(service.dispose);
  return service;
});

class PushNotificationsService {
  PushNotificationsService(this._remote);

  static const _installationKey = 'push.installationId';
  static const _androidChannelId = 'maintainpro_operational';

  final PushNotificationsRemoteDataSource _remote;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundMessageSubscription;
  bool _initialized = false;

  Future<void> bootstrap() async {
    if (_initialized) {
      return;
    }
    _initialized = true;

    await _initializeLocalNotifications();
    await _registerPushTokenIfAvailable();
  }

  Future<void> dispose() async {
    await _tokenRefreshSubscription?.cancel();
    await _foregroundMessageSubscription?.cancel();
  }

  Future<void> _initializeLocalNotifications() async {
    if (kIsWeb) {
      return;
    }

    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
      macOS: DarwinInitializationSettings(),
    );
    await _localNotifications.initialize(settings);
  }

  Future<void> _registerPushTokenIfAvailable() async {
    try {
      if (Firebase.apps.isEmpty) {
        return;
      }

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: true,
      );

      final installationId = await _getOrCreateInstallationId();
      final packageInfo = await PackageInfo.fromPlatform();
      final locale = PlatformDispatcher.instance.locale.toLanguageTag();
      final platform = defaultTargetPlatform.name;

      Future<void> registerToken(String token) async {
        if (token.isEmpty) {
          return;
        }

        await _remote.registerDevice(
          installationId: installationId,
          token: token,
          platform: platform,
          provider: 'FCM',
          appVersion: packageInfo.version,
          locale: locale,
          deviceName: '${packageInfo.appName} ${packageInfo.buildNumber}',
        );
      }

      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await registerToken(token);
      }

      _tokenRefreshSubscription = messaging.onTokenRefresh.listen((nextToken) {
        unawaited(registerToken(nextToken));
      });

      _foregroundMessageSubscription = FirebaseMessaging.onMessage.listen((message) {
        unawaited(_showForegroundNotification(message));
      });
    } catch (_) {
      // Push readiness is optional until provider credentials are configured.
    }
  }

  Future<String> _getOrCreateInstallationId() async {
    final settingsBox = Hive.box<dynamic>('settingsBox');
    final existing = settingsBox.get(_installationKey);
    if (existing is String && existing.trim().isNotEmpty) {
      return existing.trim();
    }

    const uuid = Uuid();
    final created = uuid.v4();
    await settingsBox.put(_installationKey, created);
    return created;
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    if (kIsWeb) {
      return;
    }

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannelId,
        'Operational alerts',
        channelDescription: 'MaintainPro operational notifications',
        importance: Importance.max,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
      macOS: DarwinNotificationDetails(),
    );

    await _localNotifications.show(
      message.messageId.hashCode,
      message.notification?.title ?? 'MaintainPro alert',
      message.notification?.body ?? message.data['message']?.toString(),
      details,
    );
  }
}