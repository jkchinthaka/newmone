import 'dart:ui';

import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_icons.dart';
import '../constants/app_spacing.dart';
import '../constants/app_text_styles.dart';

/// Translucent app bar with blur. Use as `appBar:` value.
class AppBarWidget extends StatelessWidget implements PreferredSizeWidget {
  const AppBarWidget({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.showBack = true,
    this.centerTitle = false,
    this.bottom,
  });

  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool showBack;
  final bool centerTitle;
  final PreferredSizeWidget? bottom;

  @override
  Size get preferredSize =>
      Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: AppBar(
          backgroundColor: AppColors.surface.withValues(alpha: 0.7),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          centerTitle: centerTitle,
          leading: leading ??
              (showBack && Navigator.of(context).canPop()
                  ? IconButton(
                      icon: const Icon(AppIcons.arrowBack, size: 18),
                      onPressed: () => Navigator.of(context).maybePop(),
                    )
                  : null),
          title: Text(title, style: AppTextStyles.title),
          actions: actions == null
              ? null
              : [
                  ...actions!,
                  const SizedBox(width: AppSpacing.xs),
                ],
          bottom: bottom,
        ),
      ),
    );
  }
}
