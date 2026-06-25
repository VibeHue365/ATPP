import 'package:flutter/material.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../core/storage/secure_storage.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  User? _user;
  bool _isChecking = true;
  bool _isLoading = false;
  String? _error;
  String? _demoOtp;

  User? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isChecking => _isChecking;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get demoOtp => _demoOtp;

  AuthProvider() {
    checkAuthStatus();
  }

  Future<void> checkAuthStatus() async {
    _isChecking = true;
    _error = null;
    notifyListeners();

    try {
      final token = await SecureStorageService.getAccessToken();
      if (token != null) {
        _user = await _authService.getMe();
      } else {
        _user = null;
      }
    } catch (e) {
      _user = null;
      // In case of error (e.g. invalid token), secure storage gets cleared inside interceptor or logout
    } finally {
      _isChecking = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _user = await _authService.login(email: email, password: password);
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

  Future<bool> register({
    required String email,
    required String password,
    required String fullName,
    required String phone,
  }) async {
    _isLoading = true;
    _error = null;
    _demoOtp = null;
    notifyListeners();

    try {
      final response = await _authService.register(
        email: email,
        password: password,
        fullName: fullName,
        phone: phone,
      );
      _demoOtp = response['demoOtp']?.toString();
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

  Future<bool> verifyEmail({required String email, required String otp}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _authService.verifyEmail(email: email, otp: otp);
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

  Future<bool> resendVerificationCode({required String email}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _authService.resendVerification(email: email);
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

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    await _authService.logout();
    _user = null;
    _isLoading = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}