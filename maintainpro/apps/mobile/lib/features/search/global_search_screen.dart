import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/app_strings.dart';
import '../../design_system/design_system.dart';

class GlobalSearchScreen extends StatefulWidget {
  const GlobalSearchScreen({super.key});

  @override
  State<GlobalSearchScreen> createState() => _GlobalSearchScreenState();
}

class _GlobalSearchScreenState extends State<GlobalSearchScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: AppStrings.searchHint,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
          ),
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => setState(() {}),
        ),
      ),
      body: _controller.text.trim().isEmpty
          ? const MpEmptyState(
              title: AppStrings.searchTitle,
              message: AppStrings.searchHint,
              icon: Icons.search,
            )
          : ListView(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              children: [
                MpCard(
                  onTap: () => context.push('/work-orders'),
                  child: MpListTile(
                    title: 'Search work orders for "${_controller.text.trim()}"',
                    subtitle: AppStrings.comingSoon,
                    leading: const Icon(Icons.build_outlined),
                  ),
                ),
              ],
            ),
    );
  }
}
