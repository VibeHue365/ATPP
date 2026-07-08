import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

class DisputeItem {
  final String id;
  final String bookingId;
  final String bookingCode;
  final String productName;
  final String customerName;
  final String customerEmail;
  final String providerName;
  final String description;
  final List<String> evidencePhotos;
  final double requestedAmount;
  final double depositTotal;
  final String status;
  final String createdAt;

  DisputeItem({
    required this.id,
    required this.bookingId,
    required this.bookingCode,
    required this.productName,
    required this.customerName,
    required this.customerEmail,
    required this.providerName,
    required this.description,
    required this.evidencePhotos,
    required this.requestedAmount,
    required this.depositTotal,
    required this.status,
    required this.createdAt,
  });

  factory DisputeItem.fromJson(Map<String, dynamic> json) {
    final booking = json['bookingId'] ?? {};
    final bookingItem = json['bookingItemId'] ?? {};
    final product = json['productId'] ?? {};
    final customer = booking['customerId'] ?? {};
    final provider = json['reportedBy'] ?? {};
    final pricingSummary = booking['pricingSummary'] ?? {};

    return DisputeItem(
      id: json['_id'] ?? '',
      bookingId: booking['_id'] ?? '',
      bookingCode: booking['bookingCode'] ?? '',
      productName: product['name'] ?? bookingItem['name'] ?? 'Phục trang Áo dài',
      customerName: customer['fullName'] ?? customer['email'] ?? 'Khách hàng',
      customerEmail: customer['email'] ?? '',
      providerName: provider['businessName'] ?? 'Đối tác',
      description: json['description'] ?? '',
      evidencePhotos: List<String>.from(json['evidencePhotos'] ?? []),
      requestedAmount: (json['requestedAmount'] ?? 0.0).toDouble(),
      depositTotal: (pricingSummary['depositTotal'] ?? 0.0).toDouble(),
      status: json['status'] ?? 'Open',
      createdAt: json['createdAt'] ?? '',
    );
  }
}

class DisputeService {
  final Dio _dio = ApiClient.dio;

  Future<List<DisputeItem>> getDisputedIncidents() async {
    try {
      final response = await _dio.get('/disputes/admin/disputed');
      final List data = response.data;
      return data.map((x) => DisputeItem.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi lấy danh sách khiếu nại';
    }
  }

  Future<void> resolveDispute({
    required String bookingId,
    required String decision,
    required String adminNotes,
  }) async {
    try {
      await _dio.post('/disputes/admin/resolve/$bookingId', data: {
        'decision': decision,
        'adminNotes': adminNotes,
      });
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi giải quyết khiếu nại';
    }
  }
}
