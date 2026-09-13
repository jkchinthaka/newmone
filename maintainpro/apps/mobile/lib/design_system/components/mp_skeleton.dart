import 'package:flutter/material.dart';

import '../tokens/radius.dart';
import '../tokens/spacing.dart';
import 'mp_card.dart';

/// Lightweight shimmer placeholder (no extra shimmer package).
class MpSkeleton extends StatefulWidget {
  const MpSkeleton({
    super.key,
    this.height = 16,
    this.width,
    this.borderRadius,
  });

  final double height;
  final double? width;
  final BorderRadius? borderRadius;

  @override
  State<MpSkeleton> createState() => _MpSkeletonState();
}

class _MpSkeletonState extends State<MpSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Opacity(
          opacity: 0.45 + (_controller.value * 0.4),
          child: Container(
            height: widget.height,
            width: widget.width ?? double.infinity,
            decoration: BoxDecoration(
              color: base,
              borderRadius: widget.borderRadius ?? MpRadius.smAll,
            ),
          ),
        );
      },
    );
  }
}

/// Stack of skeleton rows for list loading.
class MpSkeletonList extends StatelessWidget {
  const MpSkeletonList({super.key, this.count = 6});

  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(MpSpacing.screenPadding),
      itemCount: count,
      separatorBuilder: (_, __) => const SizedBox(height: MpSpacing.sm),
      itemBuilder: (_, __) => const MpCard(
        bordered: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MpSkeleton(height: 18, width: 180),
            SizedBox(height: MpSpacing.sm),
            MpSkeleton(height: 14),
            SizedBox(height: MpSpacing.xs),
            MpSkeleton(height: 14, width: 220),
          ],
        ),
      ),
    );
  }
}
