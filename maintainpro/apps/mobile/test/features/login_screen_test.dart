import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/i18n/app_strings.dart';
import 'package:maintainpro_mobile/features/auth/presentation/login_screen.dart';

void main() {
  testWidgets('LoginScreen renders email and password fields', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: LoginScreen()),
      ),
    );

    expect(find.text(AppStrings.appName), findsOneWidget);
    expect(find.text(AppStrings.signIn), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
  });
}
