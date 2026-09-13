import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/i18n/app_strings.dart';
import '../../../design_system/design_system.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _submitting = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    // Drop stale API errors before client validation so users never see
    // both a field error and a leftover "email must be an email" banner.
    ref.read(authControllerProvider.notifier).clearError();
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    final ok = await ref.read(authControllerProvider.notifier).login(
          email: _email.text.trim(),
          password: _password.text,
        );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (ok) {
      context.go('/home');
    }
  }

  void _onCredentialsChanged() {
    if (ref.read(authControllerProvider).errorMessage != null) {
      ref.read(authControllerProvider.notifier).clearError();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(MpSpacing.xl),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: MpSpacing.xl),
                    Icon(Icons.precision_manufacturing,
                        size: 48, color: scheme.primary),
                    const SizedBox(height: MpSpacing.md),
                    Text(
                      AppStrings.appName,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            color: scheme.primary,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: MpSpacing.xs),
                    Text(
                      AppStrings.loginSubtitle,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: MpSpacing.xxl),
                    MpTextField(
                      controller: _email,
                      label: AppStrings.emailLabel,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      prefixIcon: Icons.email_outlined,
                      autofillHints: const [AutofillHints.email],
                      onChanged: (_) => _onCredentialsChanged(),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return AppStrings.fieldRequired;
                        }
                        final email = v.trim();
                        // Simple local check — Nest still validates on submit.
                        final ok = RegExp(
                          r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                        ).hasMatch(email);
                        if (!ok) return AppStrings.invalidEmail;
                        return null;
                      },
                    ),
                    const SizedBox(height: MpSpacing.lg),
                    MpTextField(
                      controller: _password,
                      label: AppStrings.passwordLabel,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      prefixIcon: Icons.lock_outline,
                      autofillHints: const [AutofillHints.password],
                      onChanged: (_) => _onCredentialsChanged(),
                      onSubmitted: (_) => _submit(),
                      suffixIcon: IconButton(
                        onPressed: () =>
                            setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) {
                          return AppStrings.fieldRequired;
                        }
                        return null;
                      },
                    ),
                    if (auth.errorMessage != null) ...[
                      const SizedBox(height: MpSpacing.md),
                      Text(
                        _friendlyAuthError(auth.errorMessage!),
                        style: TextStyle(color: scheme.error),
                      ),
                    ],
                    const SizedBox(height: MpSpacing.xl),
                    MpButton(
                      label: AppStrings.signIn,
                      onPressed: _submitting ? null : _submit,
                      isLoading: _submitting,
                      icon: Icons.login,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Prefer product copy over Nest class-validator phrasing for email shape.
  static String _friendlyAuthError(String message) {
    final lower = message.toLowerCase();
    if (lower.contains('must be an email') ||
        lower == 'email must be an email') {
      return AppStrings.invalidEmail;
    }
    return message;
  }
}
