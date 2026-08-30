import 'package:flutter/material.dart';

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
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: padding ?? const EdgeInsets.all(MpSpacing.cardPadding),
      child: child,
    );

    return Card(
      margin: margin ?? EdgeInsets.zero,
      color: color,
      child: onTap == null
          ? content
          : InkWell(onTap: onTap, child: content),
    );
  }
}
