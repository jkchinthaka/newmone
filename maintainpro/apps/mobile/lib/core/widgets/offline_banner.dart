import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';
import '../constants/app_text_styles.dart';
import '../network/connectivity_provider.dart';
import '../offline/offline_queue.dart';
import '../offline/offline_sync.dart';

/// Slim banner that animates in when the device is offline. Place it just
/// below the `MaterialApp.router` (e.g., wrapped via `builder:`) so it
/// shadows every screen without disrupting routing.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider);
    final syncState = ref.watch(offlineSyncStateProvider);
    final stats = ref.watch(offlineQueueStatsProvider).valueOrNull ??
        const OfflineQueueStats();
    final pendingCount = stats.pending + stats.inFlight;

    final banner = _resolveBannerState(
      online: online,
      replaying: syncState.replaying,
      pendingCount: pendingCount,
      failedCount: stats.failed,
    );

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      height: banner == null ? 0 : 28,
      width: double.infinity,
      color: banner?.background.withValues(alpha: 0.94),
      alignment: Alignment.center,
      child: banner == null
          ? const SizedBox.shrink()
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(banner.icon, size: 16, color: banner.foreground),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  banner.message,
                  style: AppTextStyles.caption.copyWith(color: banner.foreground),
                ),
              ],
            ),
    );
  }
}

class _BannerState {
  const _BannerState({
    required this.background,
    required this.foreground,
    required this.icon,
    required this.message,
  });

  final Color background;
  final Color foreground;
  final IconData icon;
  final String message;
}

_BannerState? _resolveBannerState({
  required bool online,
  required bool replaying,
  required int pendingCount,
  required int failedCount,
}) {
  if (!online) {
    final message = pendingCount > 0
        ? "Offline · $pendingCount action${pendingCount == 1 ? '' : 's'} waiting to sync"
        : "You're offline";
    return const _BannerState(
      background: AppColors.warning,
      foreground: Colors.black87,
      icon: Icons.cloud_off,
      message: '',
    ).copyWith(message: message);
  }

  if (replaying) {
    final message = pendingCount > 0
        ? 'Syncing $pendingCount offline action${pendingCount == 1 ? '' : 's'}'
        : 'Syncing offline changes';
    return const _BannerState(
      background: AppColors.info,
      foreground: Colors.white,
      icon: Icons.sync,
      message: '',
    ).copyWith(message: message);
  }

  if (failedCount > 0) {
    final message =
        '$failedCount offline action${failedCount == 1 ? '' : 's'} need attention';
    return const _BannerState(
      background: AppColors.warning,
      foreground: Colors.black87,
      icon: Icons.sync_problem,
      message: '',
    ).copyWith(message: message);
  }

  if (pendingCount > 0) {
    final message =
        '$pendingCount offline action${pendingCount == 1 ? '' : 's'} queued for sync';
    return const _BannerState(
      background: AppColors.info,
      foreground: Colors.white,
      icon: Icons.cloud_upload,
      message: '',
    ).copyWith(message: message);
  }

  return null;
}

extension on _BannerState {
  _BannerState copyWith({
    Color? background,
    Color? foreground,
    IconData? icon,
    String? message,
  }) {
    return _BannerState(
      background: background ?? this.background,
      foreground: foreground ?? this.foreground,
      icon: icon ?? this.icon,
      message: message ?? this.message,
    );
  }
}
