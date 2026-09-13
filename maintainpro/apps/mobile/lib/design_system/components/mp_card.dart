import 'package:flutter/material.dart';

import '../tokens/radius.dart';
import '../tokens/spacing.dart';

/// Surface card for interactive content blocks.
class MpCard extends StatelessWidget {
  const MpCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding,
    this.margin,
    this.color,
    this.bordered = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final content = Padding(
      padding: padding ?? const EdgeInsets.all(MpSpacing.cardPadding),
      child: child,
    );

    final surface = color ?? scheme.surface;
    final shape = RoundedRectangleBorder(
      borderRadius: MpRadius.mdAll,
      side: bordered
          ? BorderSide(color: scheme.outline.withValues(alpha: 0.35))
          : BorderSide.none,
    );

    final card = Material(
      color: surface,
      elevation: 0,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: onTap == null
          ? content
          : InkWell(onTap: onTap, child: content),
    );

    if (margin != null) {
      return Padding(padding: margin!, child: card);
    }
    return card;
  }
}
