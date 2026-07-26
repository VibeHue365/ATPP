import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

class ChatBotResponse {
  final String answer;
  final String? category;
  final String? source;
  final List<dynamic> recommendedProducts;

  ChatBotResponse({
    required this.answer,
    this.category,
    this.source,
    this.recommendedProducts = const [],
  });

  factory ChatBotResponse.fromJson(Map<String, dynamic> json) {
    return ChatBotResponse(
      answer: json['answer'] ?? json['reply'] ?? json['message'] ?? '',
      category: json['category'],
      source: json['source'],
      recommendedProducts: json['recommended_products'] ?? [],
    );
  }
}

class ChatService {
  final Dio _dio = ApiClient.dio;

  Future<ChatBotResponse> sendChatMessage(String message) async {
    try {
      final response = await _dio.post('/ai/chat', data: {
        'message': message,
      });
      return ChatBotResponse.fromJson(response.data);
    } catch (_) {
      // Local fallback with rich Vietnamese heritage persona
      return _getHeritageOfflineResponse(message);
    }
  }

  Future<ChatBotResponse> sendChatImageMessage({
    required String base64Image,
    required String mimeType,
    String? message,
  }) async {
    try {
      final response = await _dio.post('/ai/chat/with-image', data: {
        'message': message ?? '',
        'image_base64': base64Image,
        'mime_type': mimeType,
      });
      return ChatBotResponse.fromJson(response.data);
    } catch (_) {
      return ChatBotResponse(
        answer: 'Hệ thống đang gặp sự cố khi nhìn bức họa này. Tuy nhiên, nhìn chung tà áo dài cổ phong luôn mang vẻ đẹp dịu dàng của con người Việt Nam!',
        category: 'image_analysis',
        source: 'offline_fallback',
        recommendedProducts: [],
      );
    }
  }

  ChatBotResponse _getHeritageOfflineResponse(String prompt) {
    final query = prompt.toLowerCase();
    String answer = 'Dạ, trẫm ghi nhận câu hỏi của quý khách. Cổ phục Việt Nam mang bề dày lịch sử và nét đẹp thanh tao. Quý khách cần hỗ trợ thêm thông tin gì về việc đặt lịch hay phục trang không ạ?';
    String category = 'general';

    if (query.contains('giá') || query.contains('nhiêu') || query.contains('tiền')) {
      answer = 'Dạ, giá thuê áo dài cổ phong tại VibeHue dao động từ 150.000đ đến 500.000đ mỗi ngày, tùy mẫu mã và độ tinh xảo. Quý khách có thể xem mục chi tiết sản phẩm để biết thêm thông tin cụ thể.';
      category = 'pricing';
    } else if (query.contains('địa chỉ') || query.contains('ở đâu') || query.contains('cửa hàng')) {
      answer = 'Cửa tiệm "Di Sản Áo Dài" ngự tại số 123 Phố Huế, Quận Hai Bà Trưng, Hà Nội. Giờ mở cửa đón khách từ 8 giờ sáng đến 9 giờ tối hàng ngày.';
      category = 'location';
    } else if (query.contains('chụp ảnh') || query.contains('gói chụp') || query.contains('photographer')) {
      answer = 'Chúng tôi có các gói chụp ảnh ngoại cảnh Cố Đô, chụp Studio với phục trang áo dài Việt cổ. Giá gói chụp bao gồm trang điểm và làm tóc dao động từ 1.200.000đ đến 3.500.000đ.';
      category = 'photographers';
    } else if (query.contains('chào') || query.contains('hello') || query.contains('xin chào')) {
      answer = 'Kính chào quý khách! Trẫm là trợ lý cổ phong của Di Sản Áo Dài. Trẫm có thể giúp gì cho quý khách trong việc lựa chọn tà áo quê hương?';
      category = 'greeting';
    }
    return ChatBotResponse(
      answer: answer,
      category: category,
      source: 'offline_fallback',
      recommendedProducts: [],
    );
  }
}