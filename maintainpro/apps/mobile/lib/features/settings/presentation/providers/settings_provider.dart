import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../data/datasources/settings_remote_datasource.dart';

final settingsRemoteProvider = Provider<SettingsRemoteDataSource>((ref) {
  return SettingsRemoteDataSource(ref.watch(dioProvider));
});

final settingsProfileProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(settingsRemoteProvider).getProfile();
});

final settingsOrganizationProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(settingsRemoteProvider).getOrganization();
});

final settingsSystemProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(settingsRemoteProvider).getSystem();
});

final settingsIntegrationsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(settingsRemoteProvider).getIntegrations();
});

final settingsFeatureTogglesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(settingsRemoteProvider).getFeatureToggles();
});

final settingsAutomationRulesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(settingsRemoteProvider).getAutomationRules();
});

final settingsDigestSchedulesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(settingsRemoteProvider).getDigestSchedules();
});

final settingsAuditLogsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, entity) {
  return ref.watch(settingsRemoteProvider).getAuditLogs(entity: entity);
});
