import 'package:flutter/material.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../models/booking.dart';
import '../models/voucher.dart';
import '../services/api_service.dart';

class BookingProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<Product> _products = [];
  List<Map<String, dynamic>> _photographers = [];
  List<Booking> _myBookings = [];
  bool _isLoading = false;
  String? _error;

  // Checkout State
  Voucher? _appliedVoucher;
  double _voucherDiscount = 0.0;

  List<Product> get products => _products;
  List<Map<String, dynamic>> get photographers => _photographers;
  List<Booking> get myBookings => _myBookings;
  bool get isLoading => _isLoading;
  String? get error => _error;
  Voucher? get appliedVoucher => _appliedVoucher;
  double get voucherDiscount => _voucherDiscount;

  Future<void> loadProducts() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _products = await _apiService.getProducts();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadPhotographers() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _photographers = await _apiService.getPhotographers();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadMyBookings() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _myBookings = await _apiService.getMyBookings();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> applyVoucher(String code, double orderValue, List<String> providerIds) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final voucher = await _apiService.validateVoucher(
        code: code,
        orderValue: orderValue,
        providerIds: providerIds,
      );
      _appliedVoucher = voucher;
      
      if (voucher.discountType == 'PERCENTAGE') {
        double calc = orderValue * (voucher.discountValue / 100);
        if (voucher.maxDiscount > 0 && calc > voucher.maxDiscount) {
          _voucherDiscount = voucher.maxDiscount;
        } else {
          _voucherDiscount = calc;
        }
      } else {
        _voucherDiscount = voucher.discountValue;
      }
      
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _appliedVoucher = null;
      _voucherDiscount = 0.0;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  void removeVoucher() {
    _appliedVoucher = null;
    _voucherDiscount = 0.0;
    notifyListeners();
  }

  Future<Booking> createMultiItemBooking({
    required List<CartItem> cartItems,
    required DateTime rentalFrom,
    required DateTime rentalTo,
    String? customRequests,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    // Format date as YYYY-MM-DD
    String formatDate(DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

    try {
      final List<Map<String, dynamic>> itemsList = cartItems.map((item) {
        final isHourly = item.rentalType == 'HOURLY';
        return {
          'productId': item.product.id,
          'quantity': item.quantity,
          'rentalType': item.rentalType,
          'rentalFrom': item.rentalType == 'DAILY' ? formatDate(rentalFrom) : formatDate(item.startDate),
          'rentalTo': item.rentalType == 'DAILY' ? formatDate(rentalTo) : formatDate(item.endDate),
          'selectedSize': item.selectedSize.toUpperCase(),
          'selectedColor': item.selectedColor.toUpperCase(),
          if (isHourly) ...{
            'shootDate': formatDate(item.startDate),
            'shootTimeSlot': '${item.startTime ?? "08:00"}-${item.endTime ?? "10:00"}',
          },
          if (customRequests != null && customRequests.isNotEmpty)
            'customRequests': customRequests,
        };
      }).toList();

      final Map<String, dynamic> body = {
        'bookingType': 'AODAI_RENTAL',
        'items': itemsList,
      };

      if (_appliedVoucher != null) {
        body['promoCode'] = _appliedVoucher!.code;
      }

      final booking = await _apiService.createMultiItemBooking(body);
      _isLoading = false;
      loadMyBookings(); // Reload list
      notifyListeners();
      return booking;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<Booking> createProductBooking({
    required String productId,
    required String size,
    required String color,
    required DateTime rentalFrom,
    required DateTime rentalTo,
    String? customRequests,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    // Format date as YYYY-MM-DD
    String formatDate(DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

    try {
      final Map<String, dynamic> body = {
        'productId': productId,
        'rentalType': 'DAILY',           // backend yêu cầu bắt buộc
        'startDate': formatDate(rentalFrom),
        'endDate': formatDate(rentalTo),
        'size': size,                    // đúng field name backend
        'color': color,                  // đúng field name backend
      };
      if (customRequests != null && customRequests.isNotEmpty) {
        body['customRequests'] = customRequests;
      }
      if (_appliedVoucher != null) {
        body['voucherCode'] = _appliedVoucher!.code;
      }
      
      final booking = await _apiService.createProductBooking(body);
      _isLoading = false;
      loadMyBookings(); // Reload list
      notifyListeners();
      return booking;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<Booking> createPhotographyBooking({
    required String photographerId,
    required String packageId,
    required DateTime shootDate,
    required String shootTimeSlot,
    required String shootLocation,
    required String shootConcept,
    String? referenceImage,
    String? customRequests,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final Map<String, dynamic> body = {
        'providerId': photographerId,
        'photographyPackageId': packageId,
        'shootDate': shootDate.toIso8601String(),
        'shootTimeSlot': shootTimeSlot,
        'shootLocation': shootLocation,
        'shootConcept': shootConcept,
        'referenceImage': referenceImage,
        'customRequests': customRequests,
      };
      if (_appliedVoucher != null) {
        body['voucherCode'] = _appliedVoucher!.code;
      }
      
      final booking = await _apiService.createPhotographyBooking(body);
      _isLoading = false;
      loadMyBookings(); // Reload list
      notifyListeners();
      return booking;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<String> getPaymentLink(String bookingId, String purpose) async {
    _isLoading = true;
    notifyListeners();
    try {
      final url = await _apiService.createPaymentLink(bookingId, purpose);
      _isLoading = false;
      notifyListeners();
      return url;
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> cancelBooking(String bookingId, String reason) async {
    _isLoading = true;
    notifyListeners();
    try {
      await _apiService.cancelBooking(bookingId, reason);
      await loadMyBookings();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Hủy đặt lịch và trả về kết quả chi tiết (isFreeCancel, refundAmount, penaltyReason)
  Future<Map<String, dynamic>> cancelBookingWithResult(String bookingId, String reason) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await _apiService.cancelBookingWithResult(bookingId, reason);
      await loadMyBookings();
      return result;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> submitReview({
    required String bookingId,
    required String bookingItemId,
    required int rating,
    required String comment,
    String? productId,
    String? photographyPackageId,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      await _apiService.createReview({
        'bookingId': bookingId,
        'bookingItemId': bookingItemId,
        'rating': rating,
        'comment': comment,
        'productId': productId,
        'photographyPackageId': photographyPackageId,
      });
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}