import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../services/user_chat_service.dart';
import '../core/network/api_client.dart';
import '../core/storage/secure_storage.dart';

class UserChatProvider extends ChangeNotifier {
  final UserChatService _chatService = UserChatService();

  List<DirectChatRoom> _rooms = [];
  List<DirectChatMessage> _messages = [];
  bool _isLoadingRooms = false;
  bool _isLoadingMessages = false;
  String? _currentRoomId;

  IO.Socket? _socket;
  bool _isConnected = false;

  List<DirectChatRoom> get rooms => _rooms;
  List<DirectChatMessage> get messages => _messages;
  bool get isLoadingRooms => _isLoadingRooms;
  bool get isLoadingMessages => _isLoadingMessages;
  bool get isConnected => _isConnected;
  String? get currentRoomId => _currentRoomId;

  // Initialize Socket connection
  Future<void> initSocket() async {
    if (_socket != null && _socket!.connected) return;

    final token = await SecureStorageService.getAccessToken();
    if (token == null) return;

    print('[Socket] Connecting to ${ApiClient.baseUrl}...');
    _socket = IO.io(ApiClient.baseUrl, IO.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': token})
      .enableAutoConnect()
      .build());

    _socket!.onConnect((_) {
      print('[Socket] Connected to server.');
      _isConnected = true;
      notifyListeners();

      // If there's an active room, join it again (useful on reconnect)
      if (_currentRoomId != null) {
        _socket!.emit('join_room', {'roomId': _currentRoomId});
      }
    });

    _socket!.onDisconnect((_) {
      print('[Socket] Disconnected from server.');
      _isConnected = false;
      notifyListeners();
    });

    _socket!.on('new_message', (data) {
      print('[Socket] Received new message event: $data');
      final message = DirectChatMessage.fromJson(data);
      if (message.roomId == _currentRoomId) {
        // Add to active conversation
        _messages.add(message);
        notifyListeners();
        // Automatically mark as read
        markAsRead();
      }
    });

    _socket!.on('room_update', (data) {
      print('[Socket] Received room update event: $data');
      // Reload rooms to show latest lastMessage and timestamp
      loadRooms(silent: true);
    });

    _socket!.on('messages_read', (data) {
      print('[Socket] Received messages_read event: $data');
      final String roomId = data['roomId'] ?? '';
      final String readerId = data['userId'] ?? '';
      if (roomId == _currentRoomId) {
        // Mark all messages from other sender as read
        _messages = _messages.map((m) {
          if (m.senderId != readerId) {
            return DirectChatMessage(
              id: m.id,
              roomId: m.roomId,
              senderId: m.senderId,
              messageText: m.messageText,
              attachments: m.attachments,
              isRead: true,
              createdAt: m.createdAt,
            );
          }
          return m;
        }).toList();
        notifyListeners();
      }
    });

    _socket!.connect();
  }

  // Disconnect Socket connection
  void disconnectSocket() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
      _isConnected = false;
      _currentRoomId = null;
      _messages = [];
      notifyListeners();
    }
  }

  // Load rooms
  Future<void> loadRooms({bool silent = false}) async {
    if (!silent) {
      _isLoadingRooms = true;
      notifyListeners();
    }

    try {
      _rooms = await _chatService.getRooms();
    } catch (e) {
      print('[ChatProvider] Error loading rooms: $e');
    } finally {
      if (!silent) {
        _isLoadingRooms = false;
        notifyListeners();
      }
    }
  }

  // Join a room and load its messages
  Future<void> enterRoom(String roomId) async {
    _currentRoomId = roomId;
    _messages = [];
    _isLoadingMessages = true;
    notifyListeners();

    try {
      // Connect socket if not connected
      await initSocket();

      // Join the socket room
      _socket?.emit('join_room', {'roomId': roomId});

      // Mark messages as read on server via WS
      _socket?.emit('mark_read', {'roomId': roomId});

      // Load message history from REST API
      _messages = await _chatService.getMessages(roomId);
    } catch (e) {
      print('[ChatProvider] Error entering room: $e');
    } finally {
      _isLoadingMessages = false;
      notifyListeners();
    }
  }

  // Leave current room
  void leaveRoom() {
    _currentRoomId = null;
    _messages = [];
    notifyListeners();
  }

  // Send message
  void sendMessage(String text, {List<String> attachments = const []}) {
    if (_currentRoomId == null || _socket == null) return;

    final data = {
      'roomId': _currentRoomId,
      'messageText': text,
      'attachments': attachments,
    };

    print('[Socket] Sending message: $data');
    _socket!.emit('send_message', data);
  }

  // Mark active room as read
  void markAsRead() {
    if (_currentRoomId == null || _socket == null) return;
    _socket!.emit('mark_read', {'roomId': _currentRoomId});
  }

  // Start or open a room with another user
  Future<String> startChat(String otherUserId) async {
    try {
      final room = await _chatService.getOrCreateRoom(otherUserId);
      await loadRooms(silent: true);
      return room.id;
    } catch (e) {
      print('[ChatProvider] Error starting chat: $e');
      rethrow;
    }
  }
}
