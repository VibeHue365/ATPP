import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/constants/colors.dart';
import '../../services/chat_service.dart';
import '../../models/product.dart';
import 'product_detail_view.dart';

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
      'text': 'Xin chào! Mình là Trợ lý AI cổ phong của Di sản Áo Dài. Mình có thể hỗ trợ bạn tìm hiểu các kiểu dáng thiết kế cổ áo, tay áo, tà áo và tư vấn lựa chọn chất liệu vải phù hợp hoàn hảo với vóc dáng của bạn. Bạn muốn bắt đầu tìm hiểu về phần nào ạ? 😊',
      'imageFile': null,
      'category': null,
      'source': null,
      'recommendedProducts': [],
    }
  ];

  bool _isTyping = false;

  // Selected image state
  File? _selectedImage;
  String? _selectedImageBase64;
  String? _selectedImageMimeType;

  void _pickImage() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
      if (image == null) return;

      final File file = File(image.path);
      final bytes = await file.readAsBytes();
      final base64String = base64Encode(bytes);
      final ext = image.path.split('.').last.toLowerCase();
      final mimeType = ext == 'png' ? 'image/png' : 'image/jpeg';

      setState(() {
        _selectedImage = file;
        _selectedImageBase64 = base64String;
        _selectedImageMimeType = mimeType;
      });
    } catch (_) {}
  }

  void _sendMessage({String? customText}) async {
    final text = customText ?? _messageController.text.trim();
    if (text.isEmpty && _selectedImage == null) return;

    if (customText == null) {
      _messageController.clear();
    }

    final File? imgFile = _selectedImage;
    final String? imgBase64 = _selectedImageBase64;
    final String? imgMimeType = _selectedImageMimeType;

    // Clear selection
    setState(() {
      _selectedImage = null;
      _selectedImageBase64 = null;
      _selectedImageMimeType = null;

      _messages.add({
        'role': 'user',
        'text': text.isNotEmpty ? text : 'Gửi bức họa đính kèm',
        'imageFile': imgFile,
        'category': null,
        'source': null,
        'recommendedProducts': [],
      });
      _isTyping = true;
    });
    _scrollToBottom();

    try {
      ChatBotResponse response;
      if (imgBase64 != null && imgMimeType != null) {
        response = await _chatService.sendChatImageMessage(
          base64Image: imgBase64,
          mimeType: imgMimeType,
          message: text,
        );
      } else {
        response = await _chatService.sendChatMessage(text);
      }

      setState(() {
        _messages.add({
          'role': 'bot',
          'text': response.answer,
          'imageFile': null,
          'category': response.category,
          'source': response.source,
          'recommendedProducts': response.recommendedProducts,
        });
      });
    } catch (e) {
      setState(() {
        _messages.add({
          'role': 'bot',
          'text': 'Kính mong quý khách thông cảm, hệ thống đang bận ghi chép sổ sách.',
          'imageFile': null,
          'category': null,
          'source': null,
          'recommendedProducts': [],
        });
      });
    } finally {
      setState(() {
        _isTyping = false;
      });
      _scrollToBottom();
    }
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

  Widget _buildCategoryChip(String category) {
    String label = category.toUpperCase();
    IconData icon = Icons.dashboard_customize_outlined;

    switch (category.toLowerCase()) {
      case 'collar':
        label = 'CỔ ÁO';
        icon = Icons.design_services_outlined;
        break;
      case 'sleeve':
        label = 'TAY ÁO';
        icon = Icons.gesture_outlined;
        break;
      case 'fabric':
        label = 'CHẤT LIỆU';
        icon = Icons.texture_outlined;
        break;
      case 'pricing':
        label = 'GIÁ CẢ';
        icon = Icons.sell_outlined;
        break;
      case 'size_guidance':
        label = 'KÍCH CỠ';
        icon = Icons.straighten_outlined;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[300]!, width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(
            'CHỦ ĐỀ: $label',
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSourceChip(String source) {
    String label = 'CƠ SỞ TRI THỨC';
    IconData icon = Icons.menu_book_outlined;
    Color bgColor = Colors.grey[200]!;
    Color textColor = AppColors.textSecondary;
    Color borderColor = Colors.grey[300]!;

    if (source == 'gemini_learned') {
      label = 'AI TỰ HỌC (GEMINI)';
      icon = Icons.psychology_outlined;
      bgColor = const Color(0xFFE8F5E9);
      textColor = const Color(0xFF2E7D32);
      borderColor = const Color(0xFFC8E6C9);
    } else if (source == 'offline_fallback') {
      label = 'NGOẠI TUYẾN';
      icon = Icons.wifi_off_outlined;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor, width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: textColor),
          const SizedBox(width: 4),
          Text(
            'NGUỒN: $label',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductCard(BuildContext context, Product product) {
    return Container(
      width: 140,
      margin: const EdgeInsets.only(right: 8, bottom: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.gold.withOpacity(0.3), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 3,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Product Image
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    product.imageUrl ?? 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=200',
                    fit: BoxFit.cover,
                    errorBuilder: (context, _, __) => Container(
                      color: AppColors.primaryTrans,
                      child: const Icon(Icons.image, size: 24, color: AppColors.primary),
                    ),
                  ),
                  Positioned(
                    bottom: 4,
                    right: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${product.price.toStringAsFixed(0)}đ',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Product details
          Padding(
            padding: const EdgeInsets.all(6.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  product.category,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 9,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 4),
                SizedBox(
                  width: double.infinity,
                  height: 22,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ProductDetailView(product: product),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                    child: const Text(
                      'Thuê ngay',
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestions() {
    final suggestions = [
      { 'label': 'Tư vấn cổ áo dài', 'text': 'Nên chọn dáng cổ áo dài nào để che khuyết điểm cổ ngắn?' },
      { 'label': 'Kiểu tay áo thịnh hành', 'text': 'Tư vấn các dáng tay áo dài cách tân trẻ trung?' },
      { 'label': 'Chất liệu vải lụa tơ tằm', 'text': 'Vải lụa tơ tằm có ưu điểm gì khi may áo dài?' },
      { 'label': 'Giá thuê & Dịch vụ', 'text': 'Bảng giá thuê và thời gian thuê tối đa của shop?' },
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: suggestions.map((s) {
            return Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: ActionChip(
                avatar: const Icon(Icons.chat_bubble_outline, size: 12, color: AppColors.primary),
                label: Text(
                  s['label']!,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                backgroundColor: Colors.white,
                side: const BorderSide(color: AppColors.gold, width: 0.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                onPressed: () {
                  _sendMessage(customText: s['text']);
                },
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildImagePreview() {
    if (_selectedImage == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.lightBg,
        border: Border(
          top: BorderSide(color: Colors.grey[200]!),
        ),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(7),
                  child: Image.file(
                    _selectedImage!,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              Positioned(
                top: -6,
                right: -6,
                child: GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedImage = null;
                      _selectedImageBase64 = null;
                      _selectedImageMimeType = null;
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close,
                      size: 12,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Ảnh đã chọn để tìm sản phẩm',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        ],
      ),
    );
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
                  final recommendedProducts = msg['recommendedProducts'] as List<dynamic>? ?? [];
                  final category = msg['category'] as String?;
                  final source = msg['source'] as String?;

                  return Align(
                    alignment: isBot ? Alignment.centerLeft : Alignment.centerRight,
                    child: Column(
                      crossAxisAlignment: isBot ? CrossAxisAlignment.start : CrossAxisAlignment.end,
                      children: [
                        Container(
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
                              if (msg['imageFile'] != null) ...[
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.file(
                                    msg['imageFile'] as File,
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

                        // Smart Tags (Chips)
                        if (isBot && (category != null || source != null)) ...[
                          Padding(
                            padding: const EdgeInsets.only(left: 4, bottom: 4),
                            child: Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                if (category != null && category != 'general')
                                  _buildCategoryChip(category),
                                if (source != null)
                                  _buildSourceChip(source),
                              ],
                            ),
                          ),
                        ],

                        // Recommended Products Carousel
                        if (isBot && recommendedProducts.isNotEmpty) ...[
                          Container(
                            height: 200,
                            width: MediaQuery.of(context).size.width * 0.8,
                            margin: const EdgeInsets.only(top: 4, bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                                  child: Text(
                                    'MẪU SẢN PHẨM GỢI Ý:',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.textSecondary,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: ListView.builder(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: recommendedProducts.length,
                                    itemBuilder: (context, pIndex) {
                                      final prodJson = recommendedProducts[pIndex] as Map<String, dynamic>;
                                      final product = Product.fromJson(prodJson);
                                      return _buildProductCard(context, product);
                                    },
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
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

            if (_messages.length == 1) _buildSuggestions(),
            _buildImagePreview(),

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