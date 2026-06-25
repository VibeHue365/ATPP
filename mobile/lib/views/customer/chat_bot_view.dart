import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/constants/colors.dart';
import '../../services/chat_service.dart';

class ChatBotView extends StatefulWidget {
  const ChatBotView({super.key});

  @override
  State<ChatBotView> createState() => _ChatBotViewState();
}

class _ChatBotViewState extends State<ChatBotView> {
  final ChatService _chatService = ChatService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ImagePicker _picker = ImagePicker();
  
  final List<Map<String, dynamic>> _messages = [
    {
      'role': 'bot',
      'text': 'Kính chào quý khách! Trẫm là trợ lý AI của Di Sản Áo Dài. Trẫm có thể tư vấn gì cho quý khách về phục trang cổ phong Việt Nam hay đặt lịch chụp hình tại cố đô Huế?',
      'image': null,
    }
  ];
  bool _isTyping = false;

  void _sendMessage({String? base64Image, String? mimeType, File? imageFile}) async {
    final text = _messageController.text.trim();
    if (text.isEmpty && base64Image == null) return;

    _messageController.clear();
    setState(() {
      _messages.add({
        'role': 'user',
        'text': text.isNotEmpty ? text : 'Gửi bức họa đính kèm',
        'image': imageFile,
      });
      _isTyping = true;
    });
    _scrollToBottom();

    try {
      String reply;
      if (base64Image != null && mimeType != null) {
        reply = await _chatService.sendChatImageMessage(
          base64Image: base64Image,
          mimeType: mimeType,
          message: text,
        );
      } else {
        reply = await _chatService.sendChatMessage(text);
      }

      setState(() {
        _messages.add({
          'role': 'bot',
          'text': reply,
          'image': null,
        });
      });
    } catch (e) {
      setState(() {
        _messages.add({
          'role': 'bot',
          'text': 'Kính mong quý khách thông cảm, hệ thống đang bận ghi chép sổ sách.',
          'image': null,
        });
      });
    } finally {
      setState(() {
        _isTyping = false;
      });
      _scrollToBottom();
    }
  }

  void _pickImage() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
      if (image == null) return;

      final File file = File(image.path);
      final bytes = await file.readAsBytes();
      final base64String = base64Encode(bytes);
      final ext = image.path.split('.').last.toLowerCase();
      final mimeType = ext == 'png' ? 'image/png' : 'image/jpeg';

      _sendMessage(
        base64Image: base64String,
        mimeType: mimeType,
        imageFile: file,
      );
    } catch (_) {}
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Trợ lý Cổ Phong'),
      ),
      body: Container(
        color: AppColors.lightBg,
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(16),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final msg = _messages[index];
                  final isBot = msg['role'] == 'bot';
                  return Align(
                    alignment: isBot ? Alignment.centerLeft : Alignment.centerRight,
                    child: Container(
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.of(context).size.width * 0.75,
                      ),
                      margin: const EdgeInsets.symmetric(vertical: 6),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isBot ? Colors.white : AppColors.primary,
                        borderRadius: BorderRadius.only(
                          topLeft: const Radius.circular(16),
                          topRight: const Radius.circular(16),
                          bottomLeft: isBot ? Radius.zero : const Radius.circular(16),
                          bottomRight: isBot ? const Radius.circular(16) : Radius.zero,
                        ),
                        border: isBot ? Border.all(color: AppColors.gold.withOpacity(0.5), width: 1) : null,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.04),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          )
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (msg['image'] != null) ...[
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.file(
                                msg['image'] as File,
                                width: double.infinity,
                                height: 160,
                                fit: BoxFit.cover,
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                          Text(
                            msg['text'] as String,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: isBot ? AppColors.textPrimary : Colors.white,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            if (_isTyping)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                    ),
                    SizedBox(width: 8),
                    Text('Trợ lý đang suy nghĩ...', style: TextStyle(fontStyle: FontStyle.italic, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              color: Colors.white,
              child: SafeArea(
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.photo_library_outlined, color: AppColors.primary),
                      onPressed: _pickImage,
                    ),
                    Expanded(
                      child: TextField(
                        controller: _messageController,
                        maxLines: null,
                        decoration: const InputDecoration(
                          hintText: 'Hỏi trẫm về phục trang cổ phong...',
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          filled: false,
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.send, color: AppColors.primary),
                      onPressed: () => _sendMessage(),
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