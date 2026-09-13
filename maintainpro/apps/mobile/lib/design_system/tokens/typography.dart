/// Typography tokens — system fonts only (no bundled font files).
library;

import 'package:flutter/material.dart';

abstract final class MpTypography {
  static const String fontFamily = 'Roboto';

  static TextTheme textTheme(ColorScheme scheme) {
    final base = ThemeData(brightness: scheme.brightness).textTheme;
    return base
        .apply(
          bodyColor: scheme.onSurface,
          displayColor: scheme.onSurface,
          fontFamily: fontFamily,
        )
        .copyWith(
          displayLarge: base.displayLarge?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
          headlineMedium: base.headlineMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
          titleLarge: base.titleLarge?.copyWith(fontWeight: FontWeight.w600),
          titleMedium: base.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          bodyLarge: base.bodyLarge?.copyWith(height: 1.4),
          bodyMedium: base.bodyMedium?.copyWith(height: 1.4),
          labelLarge: base.labelLarge?.copyWith(
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        );
  }
}
