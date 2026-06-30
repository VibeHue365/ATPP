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

  Future<List<String>> getCategories() async {
    try {
      final response = await _publicDio.get('/products/categories');
      final List data = response.data;
      return data.map((x) => x.toString()).toList();
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
      throw e.response?.data?['message'] ?? 'Failed to generate payment link';
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
}