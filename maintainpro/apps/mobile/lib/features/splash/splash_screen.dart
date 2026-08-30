import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_session.dart';
import '../../core/i18n/app_strings.dart';
import '../../design_system/design_system.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    // Bound bootstrap so a dead API / secure-storage blip cannot pin splash forever.
    try {
      await ref
          .read(authControllerProvider.notifier)
          .bootstrap()
          .timeout(const Duration(seconds: 8));
    } catch (_) {
      // Fall through to login when restore times out or fails.
    }
    if (!mounted) return;
    final auth = ref.read(authControllerProvider);
    if (auth.status == AuthStatus.authenticated) {
      context.go('/home');
    } else {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.primary,
              MpColors.primaryLight,
              scheme.primary.withValues(alpha: 0.85),
            ],
          ),
        ),
        child: const SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.precision_manufacturing, size: 64, color: Colors.white),
              SizedBox(height: MpSpacing.lg),
              Text(
                AppStrings.appName,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: MpSpacing.sm),
              Text(
                AppStrings.tagline,
                style: TextStyle(color: Colors.white70),
              ),
              SizedBox(height: MpSpacing.xxl),
              CircularProgressIndicator(color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}
