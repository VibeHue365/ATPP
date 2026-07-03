import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/constants/colors.dart';
import '../../providers/user_chat_provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/user_chat_service.dart';

class ChatView extends StatefulWidget {
  final String roomId;
  final String otherParticipantName;
  final String? otherParticipantAvatar;

  const ChatView({
    super.key,
    required this.roomId,
    required this.otherParticipantName,
    this.otherParticipantAvatar,
  });

  @override
  State<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<ChatView> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ImagePicker _picker = ImagePicker();
  final UserChatService _chatService = UserChatService();
  bool _isUploadingImage = false;

  @override
  void initState() {
    super.initState();
    // Scroll to bottom after build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToBottom(animated: false);
    });
  }

  @override
  void dispose() {
    // Leave room in provider to clear active room state
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<UserChatProvider>().leaveRoom();
      }
    });
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom({bool animated = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        if (animated) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        } else {
          _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
        }
      }
    });
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _messageController.clear();
    context.read<UserChatProvider>().sendMessage(text);
    _scrollToBottom();
  }

  Future<void> _pickImageAndSend() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
      if (image == null) return;

      setState(() {
        _isUploadingImage = true;
      });

      // Upload to Cloudinary via REST API
      final file = File(image.path);
      final imageUrl = await _chatService.uploadChatImage(file);

      if (imageUrl.isNotEmpty && mounted) {
        // Send message with image URL as attachment
        context.read<UserChatProvider>().sendMessage(
          'Đã gửi một bức họa đính kèm',
          attachments: [imageUrl],
        );
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể gửi ảnh: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingImage = false;
        });
      }
    }
  }

  String _formatMessageTime(DateTime dateTime) {
    return DateFormat('HH:mm').format(dateTime.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = context.watch<UserChatProvider>();
    final currentUser = context.read<AuthProvider>().user;
    final messages = chatProvider.messages;

    // Whenever message list size changes, scroll to bottom
    if (messages.isNotEmpty) {
      _scrollToBottom();
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.primaryTrans,
              backgroundImage: widget.otherParticipantAvatar != null
                  ? NetworkImage(widget.otherParticipantAvatar!)
                  : null,
              child: widget.otherParticipantAvatar == null
                  ? const Icon(
                      Icons.person,
                      color: AppColors.primary,
                      size: 18,
                    )
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    widget.otherParticipantName,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: chatProvider.isConnected ? Colors.green : Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        chatProvider.isConnected ? 'Trực tuyến' : 'Ngoại tuyến',
                        style: TextStyle(
                          fontSize: 10,
                          color: chatProvider.isConnected ? Colors.green : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Container(
        color: AppColors.lightBg,
        child: Column(
          children: [
            // Connection warning bar if not connected
            if (!chatProvider.isConnected)
              Container(
                color: AppColors.errorBg,
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
                child: const Text(
                  'Đang mất kết nối máy chủ. Vui lòng kiểm tra mạng...',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.error,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),

            // Message List Area
            Expanded(
              child: chatProvider.isLoadingMessages
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.primary),
                    )
                  : messages.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.chat_bubble_outline,
                                size: 54,
                                color: AppColors.gold.withOpacity(0.4),
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Khởi đầu cuộc trò chuyện',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const Text(
                                'Hãy gõ lời nhắn gửi để bắt đầu giao lưu.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: messages.length,
                          itemBuilder: (context, index) {
                            final msg = messages[index];
                            final bool isMe = msg.senderId == currentUser?.id;

                            return Align(
                              alignment: isMe
                                  ? Alignment.centerRight
                                  : Alignment.centerLeft,
                              child: Container(
                                constraints: BoxConstraints(
                                  maxWidth: MediaQuery.of(context).size.width * 0.72,
                                ),
                                margin: const EdgeInsets.symmetric(vertical: 5),
                                child: Column(
                                  crossAxisAlignment: isMe
                                      ? CrossAxisAlignment.end
                                      : CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 10,
                                      ),
                                      decoration: BoxDecoration(
                                        color: isMe
                                            ? AppColors.primary
                                            : Colors.white,
                                        border: isMe
                                            ? null
                                            : Border.all(
                                                color: AppColors.gold.withOpacity(0.4),
                                                width: 0.8,
                                              ),
                                        borderRadius: BorderRadius.only(
                                          topLeft: const Radius.circular(16),
                                          topRight: const Radius.circular(16),
                                          bottomLeft: isMe
                                              ? const Radius.circular(16)
                                              : Radius.zero,
                                          bottomRight: isMe
                                              ? Radius.zero
                                              : const Radius.circular(16),
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.02),
                                            blurRadius: 3,
                                            offset: const Offset(0, 1.5),
                                          )
                                        ],
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          // Attachment Image (if any)
                                          if (msg.attachments.isNotEmpty) ...[
                                            ClipRRect(
                                              borderRadius: BorderRadius.circular(8),
                                              child: Image.network(
                                                msg.attachments.first,
                                                fit: BoxFit.cover,
                                                errorBuilder: (_, __, ___) =>
                                                    Container(
                                                  color: Colors.grey[200],
                                                  width: double.infinity,
                                                  height: 120,
                                                  child: const Icon(
                                                    Icons.broken_image_outlined,
                                                    color: Colors.grey,
                                                  ),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                          ],
                                          // Message text
                                          if (msg.messageText.isNotEmpty)
                                            Text(
                                              msg.messageText,
                                              style: TextStyle(
                                                color: isMe
                                                    ? Colors.white
                                                    : AppColors.textPrimary,
                                                fontSize: 14,
                                                height: 1.35,
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    // Timestamp and read receipt
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 4.0),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            _formatMessageTime(msg.createdAt),
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: AppColors.textSecondary,
                                            ),
                                          ),
                                          if (isMe) ...[
                                            const SizedBox(width: 4),
                                            Icon(
                                              Icons.done_all,
                                              size: 11,
                                              color: msg.isRead
                                                  ? Colors.blue
                                                  : AppColors.textSecondary.withOpacity(0.6),
                                            ),
                                          ]
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),

            if (_isUploadingImage)
              Container(
                color: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Đang gửi họa phẩm lên thư viện...',
                      style: TextStyle(
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),

            // Input Box Area
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              color: Colors.white,
              child: SafeArea(
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(
                        Icons.photo_library_outlined,
                        color: AppColors.primary,
                      ),
                      onPressed: _isUploadingImage ? null : _pickImageAndSend,
                    ),
                    Expanded(
                      child: TextField(
                        controller: _messageController,
                        maxLines: null,
                        decoration: const InputDecoration(
                          hintText: 'Nhập lời nhắn gửi...',
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          filled: false,
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.send,
                        color: AppColors.primary,
                      ),
                      onPressed: _sendMessage,
                    ),
                  ],
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}
