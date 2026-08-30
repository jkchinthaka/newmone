import 'package:flutter/material.dart';

import '../tokens/radius.dart';
import '../tokens/spacing.dart';

enum MpButtonVariant { filled, outlined, text, tonal }

/// Primary action button with consistent sizing and loading state.
class MpButton extends StatelessWidget {
  const MpButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.variant = MpButtonVariant.filled,
    this.isLoading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final MpButtonVariant variant;
  final bool isLoading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final child = isLoading
        ? const SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 20),
                const SizedBox(width: MpSpacing.sm),
              ],
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            ],
          );

    final effectiveOnPressed = isLoading ? null : onPressed;

    Widget button;
    switch (variant) {
      case MpButtonVariant.filled:
        button = FilledButton(onPressed: effectiveOnPressed, child: child);
      case MpButtonVariant.outlined:
        button = OutlinedButton(onPressed: effectiveOnPressed, child: child);
      case MpButtonVariant.text:
        button = TextButton(onPressed: effectiveOnPressed, child: child);
      case MpButtonVariant.tonal:
        button = FilledButton.tonal(onPressed: effectiveOnPressed, child: child);
    }

    if (!expand) return button;
    return SizedBox(width: double.infinity, child: button);
  }
}

/// Compact icon button with Material 3 shape.
class MpIconButton extends StatelessWidget {
  const MpIconButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      icon: Icon(icon),
      tooltip: tooltip,
      style: IconButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: MpRadius.smAll),
      ),
    );
  }
}
