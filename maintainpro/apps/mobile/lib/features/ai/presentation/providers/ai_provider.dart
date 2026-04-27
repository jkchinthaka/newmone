import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/ai_remote_datasource.dart';
import '../../data/models/copilot_message.dart';

final aiRemoteProvider = Provider<AiRemoteDataSource>((ref) {
  return AiRemoteDataSource(ref.watch(dioProvider));
});

final aiConversationsProvider =
    FutureProvider.autoDispose<List<CopilotConversation>>((ref) async {
  return ref.watch(aiRemoteProvider).listConversations();
});

class AiCopilotState {
  const AiCopilotState({
    this.messages = const [],
    this.conversationId,
    this.mode = 'CHAT',
    this.focusArea = 'GENERAL',
    this.sending = false,
    this.error,
    this.suggestions = const [],
  });

  final List<CopilotMessage> messages;
  final String? conversationId;
  final String mode;
  final String focusArea;
  final bool sending;
  final String? error;
  final List<String> suggestions;

  AiCopilotState copyWith({
    List<CopilotMessage>? messages,
    String? conversationId,
    String? mode,
    String? focusArea,
    bool? sending,
    Object? error = _sentinel,
    List<String>? suggestions,
  }) {
    return AiCopilotState(
      messages: messages ?? this.messages,
      conversationId: conversationId ?? this.conversationId,
      mode: mode ?? this.mode,
      focusArea: focusArea ?? this.focusArea,
      sending: sending ?? this.sending,
      error: identical(error, _sentinel) ? this.error : error as String?,
      suggestions: suggestions ?? this.suggestions,
    );
  }
}

const _sentinel = Object();

class AiCopilotController extends StateNotifier<AiCopilotState> {
  AiCopilotController(this._ds) : super(const AiCopilotState());

  final AiRemoteDataSource _ds;

  void setMode(String mode) => state = state.copyWith(mode: mode);
  void setFocusArea(String focus) => state = state.copyWith(focusArea: focus);

  Future<void> loadConversation(String id) async {
    try {
      final msgs = await _ds.getMessages(id);
      state = state.copyWith(
        conversationId: id,
        messages: msgs,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  void reset() {
    state = AiCopilotState(mode: state.mode, focusArea: state.focusArea);
  }

  Future<void> send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.sending) return;
    final userMsg = CopilotMessage(
      role: CopilotRole.user,
      content: trimmed,
      createdAt: DateTime.now(),
    );
    state = state.copyWith(
      messages: [...state.messages, userMsg],
      sending: true,
      error: null,
    );
    try {
      final res = await _ds.copilot(
        message: trimmed,
        mode: state.mode,
        focusArea: state.focusArea,
        conversationId: state.conversationId,
      );
      final assistantMsg = CopilotMessage(
        role: CopilotRole.assistant,
        content: res.reply.isEmpty ? '(no response)' : res.reply,
        createdAt: DateTime.now(),
      );
      state = state.copyWith(
        messages: [...state.messages, assistantMsg],
        conversationId: res.conversationId ?? state.conversationId,
        sending: false,
        suggestions: res.suggestions,
      );
    } catch (e) {
      state = state.copyWith(
        sending: false,
        error: e.toString(),
      );
    }
  }
}

final aiCopilotControllerProvider =
    StateNotifierProvider.autoDispose<AiCopilotController, AiCopilotState>(
        (ref) {
  return AiCopilotController(ref.watch(aiRemoteProvider));
});
