import 'dart:io';
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

class ChatParticipant {
  final String id;
  final String fullName;
  final String? avatarUrl;
  final List<String> roles;
  final String? defaultRole;

  ChatParticipant({
    required this.id,
    required this.fullName,
    this.avatarUrl,
    required this.roles,
    this.defaultRole,
  });

  factory ChatParticipant.fromJson(Map<String, dynamic> json) {
    return ChatParticipant(
      id: json['id'] ?? json['_id'] ?? '',
      fullName: json['fullName'] ?? json['businessName'] ?? 'Người dùng',
      avatarUrl: json['avatarUrl'] ?? json['logoUrl'],
      roles: List<String>.from(json['roles'] ?? []),
      defaultRole: json['defaultRole'],
    );
  }
}

class ChatLastMessage {
  final String id;
  final String messageText;
  final String senderId;
  final bool isRead;
  final DateTime createdAt;

  ChatLastMessage({
    required this.id,
    required this.messageText,
    required this.senderId,
    required this.isRead,
    required this.createdAt,
  });

  factory ChatLastMessage.fromJson(Map<String, dynamic> json) {
    return ChatLastMessage(
      id: json['id'] ?? json['_id'] ?? '',
      messageText: json['messageText'] ?? '',
      senderId: json['senderId'] ?? '',
      isRead: json['isRead'] ?? false,
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

class DirectChatRoom {
  final String id;
  final ChatParticipant? otherParticipant;
  final ChatLastMessage? lastMessage;
  final DateTime? lastMessageAt;

  DirectChatRoom({
    required this.id,
    this.otherParticipant,
    this.lastMessage,
    this.lastMessageAt,
  });

  factory DirectChatRoom.fromJson(Map<String, dynamic> json) {
    return DirectChatRoom(
      id: json['id'] ?? json['_id'] ?? '',
      otherParticipant: json['otherParticipant'] != null
          ? ChatParticipant.fromJson(json['otherParticipant'])
          : null,
      lastMessage: json['lastMessage'] != null
          ? ChatLastMessage.fromJson(json['lastMessage'])
          : null,
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.parse(json['lastMessageAt'])
          : null,
    );
  }
}

class DirectChatMessage {
  final String id;
  final String roomId;
  final String senderId;
  final String messageText;
  final List<String> attachments;
  final bool isRead;
  final DateTime createdAt;

  DirectChatMessage({
    required this.id,
    required this.roomId,
    required this.senderId,
    required this.messageText,
    required this.attachments,
    required this.isRead,
    required this.createdAt,
  });

  factory DirectChatMessage.fromJson(Map<String, dynamic> json) {
    return DirectChatMessage(
      id: json['_id'] ?? json['id'] ?? '',
      roomId: json['roomId'] ?? '',
      senderId: json['senderId'] ?? '',
      messageText: json['messageText'] ?? '',
      attachments: List<String>.from(json['attachments'] ?? []),
      isRead: json['isRead'] ?? false,
      createdAt: DateTime.parse(json['createdAt'] ?? json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

class UserChatService {
  final Dio _dio = ApiClient.dio;

  Future<List<DirectChatRoom>> getRooms() async {
    try {
      final response = await _dio.get('/chat/rooms');
      final List data = response.data ?? [];
      return data.map((json) => DirectChatRoom.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Không thể tải danh sách phòng chat: $e');
    }
  }

  Future<List<DirectChatMessage>> getMessages(String roomId, {int limit = 100, int skip = 0}) async {
    try {
      final response = await _dio.get('/chat/rooms/$roomId/messages?limit=$limit&skip=$skip');
      final List data = response.data ?? [];
      return data.map((json) => DirectChatMessage.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Không thể tải tin nhắn: $e');
    }
  }

  Future<DirectChatRoom> getOrCreateRoom(String otherUserId) async {
    try {
      final response = await _dio.post('/chat/rooms', data: {'otherUserId': otherUserId});
      return DirectChatRoom.fromJson(response.data);
    } catch (e) {
      throw Exception('Không thể tạo phòng chat: $e');
    }
  }

  Future<String> uploadChatImage(File file) async {
    try {
      final String fileName = file.path.split('/').last;
      final FormData formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: fileName),
      });
      final response = await _dio.post('/chat/upload', data: formData);
      return response.data['url'] ?? '';
    } catch (e) {
      throw Exception('Không thể tải ảnh lên: $e');
    }
  }
}
