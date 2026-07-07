import 'dart:io';
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../models/product.dart';
import '../models/booking.dart';
import '../models/review.dart';
import '../models/voucher.dart';

class ApiService {
  final Dio _dio = ApiClient.dio;
  final Dio _publicDio = ApiClient.publicDio;

  // Products
  Future<List<Product>> getProducts() async {
    try {
      final response = await _publicDio.get('/products');
      final List data = response.data;
      return data.map((x) => Product.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch products';
    }
  }

  Future<Product> getProductById(String id) async {
    try {
      final response = await _publicDio.get('/products/$id');
      return Product.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Product not found';
    }
  }

  Future<List<CategoryItem>> getCategories() async {
    try {
      final response = await _publicDio.get('/products/categories');
      final List data = response.data;
      return data.map((x) => CategoryItem.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch categories';
    }
  }



  // Photographers
  Future<List<Map<String, dynamic>>> getPhotographers() async {
    try {
      final response = await _publicDio.get('/api/photographers');
      final List data = response.data;
      return List<Map<String, dynamic>>.from(data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch photographers';
    }
  }

  Future<List<Map<String, dynamic>>> getPhotographerPackages(String photographerId) async {
    try {
      final response = await _publicDio.get('/api/photographers/$photographerId/packages');
      final List data = response.data;
      return List<Map<String, dynamic>>.from(data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch photographer packages';
    }
  }

  // Bookings (Customer)
  Future<Booking> createProductBooking(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post('/bookings/product', data: data);
      return Booking.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to create booking';
    }
  }

  Future<Booking> createMultiItemBooking(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post('/bookings', data: data);
      return Booking.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to create booking';
    }
  }

  Future<Booking> createPhotographyBooking(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post('/bookings/photography', data: data);
      return Booking.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to create booking';
    }
  }

  Future<List<Booking>> getMyBookings() async {
    try {
      final response = await _dio.get('/bookings/my');
      final List data = response.data;
      return data.map((x) => Booking.fromJson(x)).toList();
    } on DioException catch (e) {
      // Fallback to /bookings if /bookings/my fails or returns different
      try {
        final fallback = await _dio.get('/bookings');
        final List data = fallback.data;
        return data.map((x) => Booking.fromJson(x)).toList();
      } catch (_) {
        throw e.response?.data?['message'] ?? 'Failed to fetch bookings';
      }
    }
  }

  // Bookings (Provider)
  Future<List<Booking>> getProviderBookings() async {
    try {
      final response = await _dio.get('/bookings/provider');
      final List data = response.data;
      return data.map((x) => Booking.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch provider bookings';
    }
  }

  Future<Booking> completeBooking(String bookingId) async {
    try {
      final response = await _dio.post('/bookings/$bookingId/complete');
      return Booking.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to complete booking';
    }
  }

  Future<Booking> cancelBooking(String bookingId, String reason) async {
    try {
      final response = await _dio.post('/bookings/$bookingId/cancel', data: {'reason': reason});
      return Booking.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to cancel booking';
    }
  }

  /// Trả về raw Map gồm: isFreeCancel, refundAmount, penaltyReason (giống web ProfilePage)
  Future<Map<String, dynamic>> cancelBookingWithResult(String bookingId, String reason) async {
    try {
      final response = await _dio.post('/bookings/$bookingId/cancel', data: {'reason': reason});
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return {
          'isFreeCancel': data['isFreeCancel'] ?? true,
          'refundAmount': (data['refundAmount'] ?? data['booking']?['cancellation']?['refundAmount'] ?? 0).toDouble(),
          'penaltyReason': data['penaltyReason'] ?? '',
        };
      }
      // Nếu server trả về booking object trực tiếp (không có isFreeCancel) → mặc định miễn phí
      return {'isFreeCancel': true, 'refundAmount': 0.0, 'penaltyReason': ''};
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to cancel booking';
    }
  }

  // Voucher / Promotion
  Future<Voucher> validateVoucher({
    required String code,
    required double orderValue,
    required List<String> providerIds,
  }) async {
    try {
      final response = await _dio.post('/promotions/validate', data: {
        'code': code,
        'orderValue': orderValue,
        'providerIds': providerIds,
      });
      return Voucher.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Invalid voucher code';
    }
  }

  // Payment Link (PayOS)
  Future<String> createPaymentLink(String bookingId, String purpose) async {
    try {
      final response = await _dio.post('/payments/create-link', data: {
        'bookingId': bookingId,
        'purpose': purpose,
      });
      final data = response.data;
      if (data is Map) {
        String url = data['payos']?['checkoutUrl'] ?? data['checkoutUrl'] ?? data['paymentUrl'] ?? '';
        if (Platform.isAndroid) {
          url = url.replaceAll('127.0.0.1', '10.0.2.2').replaceAll('localhost', '10.0.2.2');
        }
        return url;
      }
      return '';
    } on DioException catch (e) {
      final msg = e.response?.data?['message'];
      if (msg is List) {
        throw msg.join(', ');
      }
      throw msg ?? 'Failed to generate payment link';
    }
  }

  // Reviews
  Future<List<Review>> getProviderReviews(String providerId) async {
    try {
      final response = await _dio.get('/reviews/provider/$providerId');
      final List data = response.data;
      return data.map((x) => Review.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch reviews';
    }
  }

  Future<List<Review>> getReviewsForItem(String itemId) async {
    try {
      final response = await _publicDio.get('/reviews/item/$itemId');
      final List data = response.data;
      return data.map((x) => Review.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch reviews';
    }
  }

  Future<Review> createReview(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post('/reviews', data: data);
      return Review.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to submit review';
    }
  }

  Future<Map<String, dynamic>> getReviewStats() async {
    try {
      final response = await _dio.get('/reviews/stats');
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch review statistics';
    }
  }

  Future<void> replyToReview(String reviewId, String replyText) async {
    try {
      await _dio.post('/reviews/$reviewId/reply', data: {'reply': replyText});
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to submit reply';
    }
  }

  // Provider Portfolio & Profile
  Future<Map<String, dynamic>> getProviderProfile() async {
    try {
      final response = await _dio.get('/providers/me');
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch provider profile';
    }
  }

  Future<Map<String, dynamic>> updateProviderProfile(Map<String, dynamic> data) async {
    try {
      final response = await _dio.patch('/providers/me', data: data);
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to update profile';
    }
  }

  Future<void> addPortfolioImage(String imageUrl) async {
    try {
      await _dio.post('/providers/me/portfolio', data: {'imageUrl': imageUrl});
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to add image to portfolio';
    }
  }

  Future<void> removePortfolioImage(String imageUrl) async {
    try {
      await _dio.delete('/providers/me/portfolio', queryParameters: {'imageUrl': imageUrl});
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to remove image from portfolio';
    }
  }

  // Provider Schedules
  Future<Map<String, dynamic>> getSchedules() async {
    try {
      final response = await _dio.get('/providers/me/schedules');
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch schedules';
    }
  }

  Future<void> updateRecurringSchedule(int dayOfWeek, List<Map<String, String>> workingHours) async {
    try {
      await _dio.post('/providers/me/schedules/recurring', data: {
        'dayOfWeek': dayOfWeek,
        'workingHours': workingHours,
      });
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to update recurring schedule';
    }
  }

  Future<void> updateSpecificDateSchedule(String date, bool isOffDay, List<Map<String, dynamic>> customSlots) async {
    try {
      await _dio.post('/providers/me/schedules/specific-date', data: {
        'date': date,
        'isOffDay': isOffDay,
        'customSlots': customSlots,
      });
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to update schedule for date $date';
    }
  }

  // Provider Vouchers
  Future<List<Voucher>> getProviderVouchers() async {
    try {
      final response = await _dio.get('/promotions/provider');
      final List data = response.data;
      return data.map((x) => Voucher.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch provider promotions';
    }
  }

  Future<List<Voucher>> getPromotionsByProvider(String providerId) async {
    try {
      final response = await _dio.get('/promotions/provider-promotions/$providerId');
      final List data = response.data;
      return data.map((x) => Voucher.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch provider promotions';
    }
  }

  Future<Voucher> createVoucher(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post('/promotions', data: data);
      return Voucher.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to create promotion';
    }
  }

  Future<void> deleteVoucher(String voucherId) async {
    try {
      await _dio.delete('/promotions/$voucherId');
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to delete promotion';
    }
  }

  // Product CRUD (Provider)
  Future<List<Product>> getMyProducts() async {
    try {
      final response = await _dio.get('/products/my-listings');
      final List data = response.data;
      return data.map((x) => Product.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch your products';
    }
  }

  Future<Product> createProduct(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post('/products', data: data);
      return Product.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to create product';
    }
  }

  Future<Product> updateProduct(String id, Map<String, dynamic> data) async {
    try {
      final response = await _dio.patch('/products/$id', data: data);
      return Product.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to update product';
    }
  }

  Future<void> deleteProduct(String id) async {
    try {
      await _dio.delete('/products/$id');
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to delete product';
    }
  }

  Future<List<String>> uploadProductImages(List<String> filePaths) async {
    try {
      final List<MultipartFile> files = [];
      for (final path in filePaths) {
        final fileName = path.split('/').last;
        files.add(await MultipartFile.fromFile(path, filename: fileName));
      }
      final formData = FormData.fromMap({
        'images': files,
      });
      final response = await _dio.post('/products/upload', data: formData);
      final List urls = response.data['urls'] ?? [];
      return urls.map((x) => x.toString()).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to upload images';
    }
  }

  Future<Map<String, dynamic>> getProductBusyDates(String productId) async {
    try {
      // Endpoint yêu cầu JWT auth (class-level guard trên controller)
      final response = await _dio.get('/bookings/busy-dates/product/$productId');
      return response.data;
    } on DioException catch (e) {
      // Nếu 401 (chưa đăng nhập) thì trả về rỗng thay vì throw, tránh crash
      if (e.response?.statusCode == 401) {
        return {'bookedDates': [], 'bookedSlots': []};
      }
      throw e.response?.data?['message'] ?? 'Failed to fetch busy schedules';
    }
  }
}

class CategoryItem {
  final String id;
  final String name;

  CategoryItem({required this.id, required this.name});

  factory CategoryItem.fromJson(Map<String, dynamic> json) {
    return CategoryItem(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
    );
  }
}
