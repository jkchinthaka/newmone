import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';

final _packageInfoProvider = FutureProvider<PackageInfo>((_) {
  return PackageInfo.fromPlatform();
});

class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_packageInfoProvider);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('About'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          child: async.when(
            data: (info) => ListView(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md,
                  kToolbarHeight + AppSpacing.md, AppSpacing.md, AppSpacing.md),
              children: [
                Center(
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primaryLight.withValues(alpha: 0.18),
                      border: Border.all(
                          color: AppColors.primaryLight.withValues(alpha: 0.4)),
                    ),
                    child: const Icon(Icons.shield_moon_outlined,
                        size: 56, color: AppColors.primaryLight),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                const Text('MaintainPro',
                    style: AppTextStyles.title, textAlign: TextAlign.center),
                const Text('Operations Excellence',
                    style: AppTextStyles.bodySecondary,
                    textAlign: TextAlign.center),
                const SizedBox(height: AppSpacing.lg),
                _glass(
                  child: Column(
                    children: [
                      _row('App name', info.appName),
                      _row('Package', info.packageName),
                      _row('Version', info.version),
                      _row('Build number', info.buildNumber),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                _glass(
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Modules', style: AppTextStyles.subtitle),
                      SizedBox(height: AppSpacing.xs),
                      _Bullet('Work Orders & Maintenance'),
                      _Bullet('Assets & QR Scanning'),
                      _Bullet('Cleaning Operations'),
                      _Bullet('Fleet & Trips'),
                      _Bullet('Inventory & Suppliers'),
                      _Bullet('Utilities & Farm'),
                      _Bullet('Reports, Billing & Settings'),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text('© ${DateTime.now().year} MaintainPro',
                    style: AppTextStyles.caption, textAlign: TextAlign.center),
              ],
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
          ),
        ),
      ),
    );
  }

  Widget _glass({required Widget child}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          color: AppColors.card.withValues(alpha: 0.7),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: child,
        ),
      ),
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(
        children: [
          Expanded(child: Text(k, style: AppTextStyles.bodySecondary)),
          Text(v, style: AppTextStyles.body),
        ],
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Icon(Icons.fiber_manual_record,
                size: 6, color: AppColors.textSecondary),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(child: Text(text, style: AppTextStyles.body)),
        ],
      ),
    );
  }
}
