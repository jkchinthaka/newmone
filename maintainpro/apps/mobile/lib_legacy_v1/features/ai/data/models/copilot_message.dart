/// Roles for an AI Copilot message.
enum CopilotRole { user, assistant, system }

CopilotRole _roleFromString(String? raw) {
  switch ((raw ?? '').toLowerCase()) {
    case 'assistant':
    case 'ai':
    case 'bot':
      return CopilotRole.assistant;
    case 'system':
      return CopilotRole.system;
    default:
      return CopilotRole.user;
  }
}

/// One chat message in the AI Copilot transcript.
class CopilotMessage {
  const CopilotMessage({
    required this.role,
    required this.content,
    this.createdAt,
    this.id,
  });

  factory CopilotMessage.fromJson(Map<String, dynamic> json) {
    return CopilotMessage(
      id: json['id']?.toString(),
      role: _roleFromString(json['role']?.toString()),
      content: (json['content'] ?? json['text'] ?? '').toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  final String? id;
  final CopilotRole role;
  final String content;
  final DateTime? createdAt;

  bool get isUser => role == CopilotRole.user;
}

/// Lightweight summary of a stored conversation.
class CopilotConversation {
  const CopilotConversation({
    required this.id,
    required this.title,
    this.lastMessageAt,
    this.messageCount = 0,
    this.focusArea,
    this.mode,
  });

  factory CopilotConversation.fromJson(Map<String, dynamic> json) {
    return CopilotConversation(
      id: json['id']?.toString() ?? '',
      title: (json['title'] ?? json['name'] ?? 'Untitled').toString(),
      lastMessageAt:
          DateTime.tryParse(json['lastMessageAt']?.toString() ?? '') ??
              DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
      messageCount: (json['messageCount'] as num?)?.toInt() ?? 0,
      focusArea: json['focusArea']?.toString(),
      mode: json['mode']?.toString(),
    );
  }

  final String id;
  final String title;
  final DateTime? lastMessageAt;
  final int messageCount;
  final String? focusArea;
  final String? mode;
}

/// Result of a /ai/copilot call.
class CopilotResponse {
  const CopilotResponse({
    required this.reply,
    this.conversationId,
    this.suggestions = const [],
    this.actions = const [],
    this.metadata,
  });

  factory CopilotResponse.fromJson(Map<String, dynamic> json) {
    return CopilotResponse(
      reply: (json['reply'] ??
              json['message'] ??
              json['answer'] ??
              json['content'] ??
              '')
          .toString(),
      conversationId: json['conversationId']?.toString(),
      suggestions:
          (json['suggestions'] as List?)?.map((e) => e.toString()).toList() ??
              const [],
      actions: (json['actions'] as List?)
              ?.whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList() ??
          const [],
      metadata: json['metadata'] is Map
          ? Map<String, dynamic>.from(json['metadata'] as Map)
          : null,
    );
  }

  final String reply;
  final String? conversationId;
  final List<String> suggestions;
  final List<Map<String, dynamic>> actions;
  final Map<String, dynamic>? metadata;
}
