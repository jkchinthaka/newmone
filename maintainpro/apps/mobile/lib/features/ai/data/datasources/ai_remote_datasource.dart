import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/copilot_message.dart';

/// Talks to the backend `/api/ai/*` endpoints (mounted alongside
/// `/api/predictive-ai/*` by the same controller).
class AiRemoteDataSource {
  AiRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  Future<CopilotResponse> copilot({
    required String message,
    String mode = 'CHAT',
    String focusArea = 'GENERAL',
    String? conversationId,
    String? conversationTitle,
    bool markdown = true,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.aiCopilot,
        data: {
          'message': message,
          'mode': mode,
          'focusArea': focusArea,
          'markdown': markdown,
          if (conversationId != null) 'conversationId': conversationId,
          if (conversationTitle != null) 'conversationTitle': conversationTitle,
        },
      );
      final data = _unwrap(res);
      if (data is Map) {
        return CopilotResponse.fromJson(Map<String, dynamic>.from(data));
      }
      return CopilotResponse(reply: data?.toString() ?? '');
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> context() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.aiContext);
      final data = _unwrap(res);
      return data is Map
          ? Map<String, dynamic>.from(data)
          : <String, dynamic>{};
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<CopilotConversation>> listConversations() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.aiConversations);
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map(
              (e) => CopilotConversation.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<CopilotConversation> createConversation({
    required String title,
    String? focusArea,
    String? mode,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.aiConversations,
        data: {
          'title': title,
          if (focusArea != null) 'focusArea': focusArea,
          if (mode != null) 'mode': mode,
        },
      );
      final data = _unwrap(res);
      return CopilotConversation.fromJson(
          Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<CopilotMessage>> getMessages(String conversationId) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.aiConversationMessages(conversationId),
      );
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => CopilotMessage.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
