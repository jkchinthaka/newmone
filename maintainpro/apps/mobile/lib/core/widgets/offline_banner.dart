import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';
import '../constants/app_text_styles.dart';
import '../network/connectivity_provider.dart';

/// Slim banner that animates in when the device is offline. Place it just
/// below the `MaterialApp.router` (e.g., wrapped via `builder:`) so it
/// shadows every screen without disrupting routing.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      height: online ? 0 : 28,
      width: double.infinity,
      color: AppColors.warning.withValues(alpha: 0.92),
      alignment: Alignment.center,
      child: online
          ? const SizedBox.shrink()
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.cloud_off, size: 16, color: Colors.black87),
                const SizedBox(width: AppSpacing.xs),
                Text("You're offline",
                    style:
                        AppTextStyles.caption.copyWith(color: Colors.black87)),
              ],
            ),
    );
  }
}
