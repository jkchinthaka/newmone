import 'package:flutter/material.dart';

import 'tokens/colors.dart';
import 'tokens/elevation.dart';
import 'tokens/radius.dart';
import 'tokens/typography.dart';

/// MaintainPro Material 3 themes. Light is the default for outdoor sunlight use.
abstract final class MpTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: MpColors.primary,
      brightness: Brightness.light,
      primary: MpColors.primary,
      secondary: MpColors.secondary,
      tertiary: MpColors.tertiary,
      error: MpColors.error,
      surface: MpColors.surfaceContainerLight,
    ).copyWith(
      onPrimary: MpColors.onPrimary,
      onSecondary: MpColors.onSecondary,
      onTertiary: MpColors.onTertiary,
      outline: MpColors.outlineLight,
      surfaceContainerHighest: MpColors.surfaceLight,
    );

    return _build(scheme, scaffold: MpColors.scaffoldLight);
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: MpColors.primaryLight,
      brightness: Brightness.dark,
      primary: MpColors.primaryLight,
      secondary: MpColors.secondary,
      tertiary: MpColors.tertiary,
      error: MpColors.error,
      surface: MpColors.surfaceContainerDark,
    ).copyWith(
      onPrimary: MpColors.onSurfaceDark,
      outline: MpColors.outlineDark,
      surfaceContainerHighest: MpColors.surfaceDark,
    );

    return _build(scheme, scaffold: MpColors.scaffoldDark);
  }

  static ThemeData _build(ColorScheme scheme, {required Color scaffold}) {
    final textTheme = MpTypography.textTheme(scheme);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffold,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: MpElevation.none,
        scrolledUnderElevation: MpElevation.low,
        backgroundColor: scaffold,
        foregroundColor: scheme.onSurface,
        titleTextStyle: textTheme.titleLarge,
      ),
      cardTheme: CardThemeData(
        elevation: MpElevation.low,
        shape: RoundedRectangleBorder(borderRadius: MpRadius.mdAll),
        clipBehavior: Clip.antiAlias,
        color: scheme.surface,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.5),
        border: OutlineInputBorder(borderRadius: MpRadius.mdAll),
        enabledBorder: OutlineInputBorder(
          borderRadius: MpRadius.mdAll,
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: MpRadius.mdAll,
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: MpRadius.mdAll),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: MpRadius.mdAll),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: scheme.primary.withValues(alpha: 0.15),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return textTheme.labelMedium?.copyWith(
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
          );
        }),
      ),
      navigationRailTheme: NavigationRailThemeData(
        indicatorColor: scheme.primary.withValues(alpha: 0.15),
        selectedIconTheme: IconThemeData(color: scheme.primary),
        selectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: scheme.primary,
          fontWeight: FontWeight.w600,
        ),
      ),
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(borderRadius: MpRadius.smAll),
        side: BorderSide(color: scheme.outline.withValues(alpha: 0.5)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: MpRadius.mdAll),
      ),
      dividerTheme: DividerThemeData(color: scheme.outline.withValues(alpha: 0.4)),
    );
  }
}
