import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/copilot_message.dart';
import 'providers/ai_provider.dart';

/// Mobile parity for the web "AI Assistant" / Copilot chat experience.
class AiAssistantScreen extends ConsumerStatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  ConsumerState<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends ConsumerState<AiAssistantScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();

  static const _modes = ['CHAT', 'ANALYZE', 'PREDICT', 'RECOMMEND'];
  static const _focusAreas = [
    'GENERAL',
    'MAINTENANCE',
    'FLEET',
    'CLEANING',
    'INVENTORY',
    'UTILITIES',
  ];

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text;
    if (text.trim().isEmpty) return;
    _controller.clear();
    HapticFeedback.selectionClick();
    await ref.read(aiCopilotControllerProvider.notifier).send(text);
    if (!mounted) return;
    if (_scroll.hasClients) {
      await _scroll.animateTo(
        _scroll.position.maxScrollExtent + 200,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(aiCopilotControllerProvider);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('AI Assistant'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'New chat',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () =>
                ref.read(aiCopilotControllerProvider.notifier).reset(),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          child: Column(
            children: [
              _ModeBar(
                mode: state.mode,
                focusArea: state.focusArea,
                modes: _modes,
                focusAreas: _focusAreas,
                onModeChanged: (v) =>
                    ref.read(aiCopilotControllerProvider.notifier).setMode(v),
                onFocusChanged: (v) => ref
                    .read(aiCopilotControllerProvider.notifier)
                    .setFocusArea(v),
              ),
              Expanded(
                child: state.messages.isEmpty
                    ? _EmptyState(
                        suggestions: const [
                          'Summarize today\u2019s critical alerts',
                          'Predict failures for top 5 assets',
                          'Recommend maintenance for fleet',
                          'Why is inventory turnover dropping?',
                        ],
                        onPick: (s) {
                          _controller.text = s;
                          _send();
                        },
                      )
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.all(AppSpacing.md),
                        itemCount:
                            state.messages.length + (state.sending ? 1 : 0),
                        itemBuilder: (ctx, i) {
                          if (i >= state.messages.length) {
                            return const _TypingBubble();
                          }
                          return _MessageBubble(message: state.messages[i]);
                        },
                      ),
              ),
              if (state.error != null)
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  child: Text(state.error!,
                      style:
                          AppTextStyles.label.copyWith(color: AppColors.error)),
                ),
              if (state.suggestions.isNotEmpty)
                _SuggestionRow(
                  suggestions: state.suggestions,
                  onPick: (s) {
                    _controller.text = s;
                    _send();
                  },
                ),
              _Composer(
                controller: _controller,
                sending: state.sending,
                onSend: _send,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeBar extends StatelessWidget {
  const _ModeBar({
    required this.mode,
    required this.focusArea,
    required this.modes,
    required this.focusAreas,
    required this.onModeChanged,
    required this.onFocusChanged,
  });

  final String mode;
  final String focusArea;
  final List<String> modes;
  final List<String> focusAreas;
  final ValueChanged<String> onModeChanged;
  final ValueChanged<String> onFocusChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
      child: Row(
        children: [
          Expanded(
            child: _PillDropdown<String>(
              icon: Icons.auto_awesome_rounded,
              value: mode,
              items: modes,
              labelFor: (v) => v,
              onChanged: (v) {
                if (v != null) onModeChanged(v);
              },
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _PillDropdown<String>(
              icon: Icons.tune_rounded,
              value: focusArea,
              items: focusAreas,
              labelFor: (v) => v,
              onChanged: (v) {
                if (v != null) onFocusChanged(v);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _PillDropdown<T> extends StatelessWidget {
  const _PillDropdown({
    required this.icon,
    required this.value,
    required this.items,
    required this.labelFor,
    required this.onChanged,
  });

  final IconData icon;
  final T value;
  final List<T> items;
  final String Function(T) labelFor;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primaryLight),
          const SizedBox(width: 6),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<T>(
                value: value,
                isExpanded: true,
                isDense: true,
                dropdownColor: const Color(0xFF1E2746),
                style: AppTextStyles.label.copyWith(color: Colors.white),
                items: items
                    .map((e) => DropdownMenuItem(
                          value: e,
                          child: Text(labelFor(e)),
                        ))
                    .toList(),
                onChanged: onChanged,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});
  final CopilotMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    final bg =
        isUser ? AppColors.primary : Colors.white.withValues(alpha: 0.08);
    final align = isUser ? Alignment.centerRight : Alignment.centerLeft;
    return Align(
      alignment: align,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.82,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isUser ? 16 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 16),
          ),
          border: isUser
              ? null
              : Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: SelectableText(
          message.content,
          style: AppTextStyles.body.copyWith(color: Colors.white),
        ),
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const SizedBox(
          width: 24,
          height: 16,
          child: Center(
            child: SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      ),
    );
  }
}

class _SuggestionRow extends StatelessWidget {
  const _SuggestionRow({required this.suggestions, required this.onPick});
  final List<String> suggestions;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        itemCount: suggestions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, i) {
          final s = suggestions[i];
          return ActionChip(
            label: Text(s, maxLines: 1, overflow: TextOverflow.ellipsis),
            onPressed: () => onPick(s),
          );
        },
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.md),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 5,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                hintText: 'Ask the assistant...',
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.06),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 8),
          FloatingActionButton.small(
            heroTag: 'ai-send',
            onPressed: sending ? null : onSend,
            child: sending
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send_rounded),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.suggestions, required this.onPick});
  final List<String> suggestions;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        const SizedBox(height: AppSpacing.lg),
        const Icon(Icons.auto_awesome_rounded,
            size: 64, color: AppColors.primaryLight),
        const SizedBox(height: AppSpacing.md),
        const Text('How can I help?',
            textAlign: TextAlign.center, style: AppTextStyles.title),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Ask about maintenance, fleet, cleaning, inventory or utilities. '
          'Switch mode to analyze, predict or recommend.',
          textAlign: TextAlign.center,
          style: AppTextStyles.body
              .copyWith(color: Colors.white.withValues(alpha: 0.7)),
        ),
        const SizedBox(height: AppSpacing.xl),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: [
            for (final s in suggestions)
              ActionChip(
                avatar: const Icon(Icons.bolt_rounded, size: 16),
                label: Text(s),
                onPressed: () => onPick(s),
              ),
          ],
        ),
      ],
    );
  }
}
