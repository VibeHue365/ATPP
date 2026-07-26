import 'package:flutter/material.dart';
import '../models/booking.dart';
import '../models/voucher.dart';
import '../models/review.dart';
import '../models/product.dart';
import '../services/api_service.dart';

class ProviderProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<Booking> _providerBookings = [];
  List<Voucher> _providerVouchers = [];
  List<Review> _reviews = [];
  List<Product> _myProducts = [];
  Map<String, dynamic> _reviewStats = {};
  Map<String, dynamic> _providerProfile = {};
  Map<String, dynamic> _schedules = {};
  
  bool _isLoading = false;
  String? _error;

  List<Booking> get providerBookings => _providerBookings;
  List<Voucher> get providerVouchers => _providerVouchers;
  List<Review> get reviews => _reviews;
  List<Product> get myProducts => _myProducts;
  Map<String, dynamic> get reviewStats => _reviewStats;
  Map<String, dynamic> get providerProfile => _providerProfile;
  Map<String, dynamic> get schedules => _schedules;
  bool get isLoading => _isLoading;
  String? get error => _error;


  Future<void> loadProviderProfile() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _providerProfile = await _apiService.getProviderProfile();
      if (_providerProfile['_id'] != null) {
        // Load reviews for this provider
        _reviews = await _apiService.getProviderReviews(_providerProfile['_id']);
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadProviderBookings() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _providerBookings = await _apiService.getProviderBookings();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadProviderVouchers() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _providerVouchers = await _apiService.getProviderVouchers();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadReviewStats() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _reviewStats = await _apiService.getReviewStats();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadSchedules() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _schedules = await _apiService.getSchedules();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createVoucher(Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.createVoucher(data);
      await loadProviderVouchers();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteVoucher(String voucherId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.deleteVoucher(voucherId);
      await loadProviderVouchers();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateRecurringSchedule(int dayOfWeek, List<Map<String, String>> slots) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.updateRecurringSchedule(dayOfWeek, slots);
      await loadSchedules();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateSpecificDateSchedule(String date, bool isOffDay, List<Map<String, dynamic>> slots) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.updateSpecificDateSchedule(date, isOffDay, slots);
      await loadSchedules();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> addPortfolioImage(String imageUrl) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.addPortfolioImage(imageUrl);
      await loadProviderProfile();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> removePortfolioImage(String imageUrl) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.removePortfolioImage(imageUrl);
      await loadProviderProfile();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> replyToReview(String reviewId, String replyText) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.replyToReview(reviewId, replyText);
      if (_providerProfile['_id'] != null) {
        _reviews = await _apiService.getProviderReviews(_providerProfile['_id']);
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> loadMyProducts() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _myProducts = await _apiService.getMyProducts();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addProduct(Map<String, dynamic> data, List<String> imagePaths) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      List<String> uploadedUrls = [];
      if (imagePaths.isNotEmpty) {
        uploadedUrls = await _apiService.uploadProductImages(imagePaths);
      }
      final productData = Map<String, dynamic>.from(data);
      productData['images'] = uploadedUrls;
      
      await _apiService.createProduct(productData);
      await loadMyProducts();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> editProduct(String id, Map<String, dynamic> data, List<String> newImagePaths, List<String> existingImages) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      List<String> uploadedUrls = [];
      if (newImagePaths.isNotEmpty) {
        uploadedUrls = await _apiService.uploadProductImages(newImagePaths);
      }
      final productData = Map<String, dynamic>.from(data);
      productData['images'] = [...existingImages, ...uploadedUrls];
      
      await _apiService.updateProduct(id, productData);
      await loadMyProducts();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> removeProduct(String id) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.deleteProduct(id);
      await loadMyProducts();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
}