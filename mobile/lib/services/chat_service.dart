import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

class ChatService {
  final Dio _dio = ApiClient.dio;

  Future<String> sendChatMessage(String message) async {
    try {
      final response = await _dio.post('/ai/chat', data: {
        'message': message,
      });
      return response.data['reply'] ?? response.data['message'] ?? 'Xin lỗi quý khách, trẫm chưa hiểu ý.';
    } catch (_) {
      // Local fallback with rich Vietnamese heritage persona
      return _getHeritageOfflineResponse(message);
    }
  }

  Future<String> sendChatImageMessage({
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
      return response.data['reply'] ?? response.data['message'] ?? 'Bức họa thật tuyệt mỹ!';
    } catch (_) {
      return 'Hệ thống đang gặp sự cố khi nhìn bức họa này. Tuy nhiên, nhìn chung tà áo dài cổ phong luôn mang vẻ đẹp dịu dàng của con người Việt Nam!';
    }
  }

  String _getHeritageOfflineResponse(String prompt) {
    final query = prompt.toLowerCase();
    if (query.contains('giá') || query.contains('nhiêu') || query.contains('tiền')) {
      return 'Dạ, giá thuê áo dài cổ phong tại VibeHue dao động từ 150.000đ đến 500.000đ mỗi ngày, tùy mẫu mã và độ tinh xảo. Quý khách có thể xem mục chi tiết sản phẩm để biết thêm thông tin cụ thể.';
    } else if (query.contains('địa chỉ') || query.contains('ở đâu') || query.contains('cửa hàng')) {
      return 'Cửa tiệm "Di Sản Áo Dài" ngự tại số 123 Phố Huế, Quận Hai Bà Trưng, Hà Nội. Giờ mở cửa đón khách từ 8 giờ sáng đến 9 giờ tối hàng ngày.';
    } else if (query.contains('chụp ảnh') || query.contains('gói chụp') || query.contains('photographer')) {
      return 'Chúng tôi có các gói chụp ảnh ngoại cảnh Cố Đô, chụp Studio với phục trang áo dài Việt cổ. Giá gói chụp bao gồm trang điểm và làm tóc dao động từ 1.200.000đ đến 3.500.000đ.';
    } else if (query.contains('chào') || query.contains('hello') || query.contains('xin chào')) {
      return 'Kính chào quý khách! Trẫm là trợ lý cổ phong của Di Sản Áo Dài. Trẫm có thể giúp gì cho quý khách trong việc lựa chọn tà áo quê hương?';
    }
    return 'Dạ, trẫm ghi nhận câu hỏi của quý khách. Cổ phục Việt Nam mang bề dày lịch sử và nét đẹp thanh tao. Quý khách cần hỗ trợ thêm thông tin gì về việc đặt lịch hay phục trang không ạ?';
  }
}