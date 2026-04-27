import 'package:flutter/material.dart';

import 'cleaning_visits_screen.dart';

/// Focused view of the visits queue, pre-filtered to those waiting for
/// supervisor sign-off. Mirrors the web "Sign-off queue" tab.
class CleaningSignoffQueueScreen extends StatelessWidget {
  const CleaningSignoffQueueScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CleaningVisitsScreen(initialStatus: 'SUBMITTED');
  }
}
