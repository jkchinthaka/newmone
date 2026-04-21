import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

final offlineQueueProvider = Provider<OfflineQueue>((_) => OfflineQueue());

class OfflineAction {
  OfflineAction({
    required this.id,
    required this.path,
    required this.method,
    required this.payload,
  });

  final String id;
  final String path;
  final String method;
  final Map<String, dynamic> payload;

  Map<String, dynamic> toJson() => {
        'id': id,
        'path': path,
        'method': method,
        'payload': payload,
      };

  static OfflineAction fromJson(Map<String, dynamic> json) {
    return OfflineAction(
      id: json['id'] as String,
      path: json['path'] as String,
      method: json['method'] as String,
      payload: Map<String, dynamic>.from(json['payload'] as Map),
    );
  }
}

class OfflineQueue {
  static const _boxName = 'maintainpro_offline_actions';
  final Uuid _uuid = const Uuid();

  Future<void> add({
    required String path,
    required String method,
    required Map<String, dynamic> payload,
  }) async {
    final box = await _openBox();
    final action = OfflineAction(
      id: _uuid.v4(),
      path: path,
      method: method,
      payload: payload,
    );

    await box.add(jsonEncode(action.toJson()));
  }

  Future<List<OfflineAction>> list() async {
    final box = await _openBox();
    return box.values
        .map((item) => OfflineAction.fromJson(
            jsonDecode(item as String) as Map<String, dynamic>))
        .toList();
  }

  Future<void> clear() async {
    final box = await _openBox();
    await box.clear();
  }

  Future<Box> _openBox() {
    return Hive.openBox(_boxName);
  }
}
