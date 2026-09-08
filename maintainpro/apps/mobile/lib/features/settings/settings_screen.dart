import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/app_strings.dart';
import '../../core/network/dio_client.dart';
import '../../design_system/design_system.dart';

final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.light);

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final config = ref.watch(appConfigProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.settingsTitle)),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          const MpSectionHeader(title: 'Appearance'),
          MpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SegmentedButton<ThemeMode>(
                  segments: const [
                    ButtonSegment(
                      value: ThemeMode.light,
                      label: Text(AppStrings.themeLight),
                      icon: Icon(Icons.light_mode_outlined),
                    ),
                    ButtonSegment(
                      value: ThemeMode.dark,
                      label: Text(AppStrings.themeDark),
                      icon: Icon(Icons.dark_mode_outlined),
                    ),
                    ButtonSegment(
                      value: ThemeMode.system,
                      label: Text(AppStrings.themeSystem),
                      icon: Icon(Icons.settings_suggest_outlined),
                    ),
                  ],
                  selected: {themeMode},
                  onSelectionChanged: (set) {
                    ref.read(themeModeProvider.notifier).state = set.first;
                  },
                ),
              ],
            ),
          ),
          const MpSectionHeader(title: 'Language'),
          MpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(AppStrings.languageEnglish,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: MpSpacing.xs),
                Text(
                  AppStrings.languageComingSoon,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const MpSectionHeader(title: 'Environment'),
          MpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Flavor: ${config.flavor.label}'),
                const SizedBox(height: MpSpacing.xs),
                Text(
                  'API: ${config.apiRoot}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
