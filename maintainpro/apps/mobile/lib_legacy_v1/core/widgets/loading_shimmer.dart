import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';

/// Animated gradient sweep used as list/card loading placeholder.
class LoadingShimmer extends StatelessWidget {
  const LoadingShimmer({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.radius = 8,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFF374151),
      highlightColor: const Color(0xFF4B5563),
      period: const Duration(milliseconds: 1500),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.border,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

/// Card-shaped shimmer for use in list skeletons.
class CardShimmer extends StatelessWidget {
  const CardShimmer({super.key, this.height = 96});
  final double height;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.xs),
      child: LoadingShimmer(height: height, radius: AppRadius.lg),
    );
  }
}
