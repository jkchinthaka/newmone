import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/secure_token_store.dart';
import 'data/notifications_api_client.dart';
import 'notification_deep_link.dart';

typedef DeepLinkHandler = void Function(String route);

class PushNotificationsService {
  PushNotificationsService({
    required NotificationsApiClient api,
    required SecureTokenStore tokens,
  })  : _api = api,
        _tokens = tokens;

  static const _androidChannelId = 'maintainpro_operational';

  final NotificationsApiClient _api;
  final SecureTokenStore _tokens;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundMessageSubscription;
  StreamSubscription<RemoteMessage>? _openedAppSubscription;
  bool _initialized = false;
  DeepLinkHandler? _onDeepLink;

  Future<void> bootstrap({DeepLinkHandler? onDeepLink}) async {
    _onDeepLink = onDeepLink;
    if (_initialized) {
      await _registerPushTokenIfAvailable();
      return;
    }
    _initialized = true;

    await _initializeLocalNotifications();
    await _registerPushTokenIfAvailable();
    await _wireOpenHandlers();
  }

  Future<void> dispose() async {
    await _tokenRefreshSubscription?.cancel();
    await _foregroundMessageSubscription?.cancel();
    await _openedAppSubscription?.cancel();
  }

  Future<void> unregisterDevice() async {
    try {
      final installationId = await _tokens.readPushInstallationId();
      if (installationId != null && installationId.isNotEmpty) {
        await _api.unregisterPushDevice(installationId);
      }
    } catch (_) {
      // Best-effort cleanup during logout.
    }
  }

  Future<void> _initializeLocalNotifications() async {
    if (kIsWeb) return;

    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    );
    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: (details) {
        final payload = details.payload;
        if (payload != null && payload.isNotEmpty) {
          _onDeepLink?.call(payload);
        }
      },
    );

    if (defaultTargetPlatform == TargetPlatform.android) {
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(
            const AndroidNotificationChannel(
              _androidChannelId,
              'Operational alerts',
              description: 'MaintainPro operational notifications',
              importance: Importance.max,
            ),
          );
    }
  }

  Future<void> _registerPushTokenIfAvailable() async {
    try {
      if (Firebase.apps.isEmpty) return;

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: true,
      );

      final installationId = await _tokens.getOrCreatePushInstallationId();
      final platform = defaultTargetPlatform.name;
      final locale = PlatformDispatcher.instance.locale.toLanguageTag();

      Future<void> registerToken(String token) async {
        if (token.isEmpty) return;
        await _api.registerPushDevice(
          installationId: installationId,
          token: token,
          platform: platform,
          provider: 'FCM',
          locale: locale,
          deviceName: 'MaintainPro Mobile',
        );
      }

      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await registerToken(token);
      }

      await _tokenRefreshSubscription?.cancel();
      _tokenRefreshSubscription =
          messaging.onTokenRefresh.listen((nextToken) {
        unawaited(registerToken(nextToken));
      });

      await _foregroundMessageSubscription?.cancel();
      _foregroundMessageSubscription =
          FirebaseMessaging.onMessage.listen((message) {
        unawaited(_showForegroundNotification(message));
      });
    } catch (_) {
      // Push is optional until Firebase credentials are configured.
    }
  }

  Future<void> _wireOpenHandlers() async {
    if (Firebase.apps.isEmpty) return;

    final messaging = FirebaseMessaging.instance;
    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      _handleRemoteOpen(initial);
    }

    await _openedAppSubscription?.cancel();
    _openedAppSubscription =
        FirebaseMessaging.onMessageOpenedApp.listen(_handleRemoteOpen);
  }

  void _handleRemoteOpen(RemoteMessage message) {
    final route = _routeFromMessage(message);
    if (route != null) {
      _onDeepLink?.call(route);
    }
  }

  String? _routeFromMessage(RemoteMessage message) {
    final data = message.data;
    return resolveNotificationDeepLink(
      deepLink: data['deepLink']?.toString(),
      referenceType: data['referenceType']?.toString(),
      referenceId: data['referenceId']?.toString(),
    );
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    if (kIsWeb) return;

    final route = _routeFromMessage(message);
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannelId,
        'Operational alerts',
        channelDescription: 'MaintainPro operational notifications',
        importance: Importance.max,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    );

    await _localNotifications.show(
      message.messageId?.hashCode ?? message.hashCode,
      message.notification?.title ?? 'MaintainPro alert',
      message.notification?.body ?? message.data['message']?.toString(),
      details,
      payload: route,
    );
  }
}

final pushNotificationsServiceProvider = Provider<PushNotificationsService>((ref) {
  final service = PushNotificationsService(
    api: ref.watch(notificationsApiClientProvider),
    tokens: ref.watch(secureTokenStoreProvider),
  );
  ref.onDispose(service.dispose);
  return service;
});

/// Unread count for shell badge — refreshed on alerts load and auth bootstrap.
final unreadNotificationsCountProvider =
    StateProvider<int>((ref) => 0);
