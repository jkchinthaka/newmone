import 'package:flutter/material.dart';

import '../tokens/spacing.dart';

/// Full-screen or inline loading indicator.
class MpLoading extends StatelessWidget {
  const MpLoading({
    super.key,
    this.message,
    this.centered = true,
  });

  final String? message;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircularProgressIndicator(),
        if (message != null) ...[
          const SizedBox(height: MpSpacing.lg),
          Text(
            message!,
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );

    if (!centered) return content;
    return Center(child: content);
  }
}
