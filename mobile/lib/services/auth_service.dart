import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/storage/secure_storage.dart';
import '../models/user.dart';

class AuthService {
  final Dio _dio = ApiClient.dio;
  final Dio _publicDio = ApiClient.publicDio;

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String fullName,
    required String phone,
  }) async {
    try {
      final response = await _publicDio.post('/auth/register', data: {
        'email': email,
        'password': password,
        'fullName': fullName,
        'phone': phone,
      });
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to register';
    }
  }

  Future<Map<String, dynamic>> verifyEmail({
    required String email,
    required String otp,
  }) async {
    try {
      final response = await _publicDio.post('/auth/verify-email', data: {
        'email': email,
        'otp': otp,
      });
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Invalid verification code';
    }
  }

  Future<Map<String, dynamic>> resendVerification({
    required String email,
  }) async {
    try {
      final response = await _publicDio.post('/auth/resend-verification', data: {
        'email': email,
      });
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to resend code';
    }
  }

  Future<User> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _publicDio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      
      final data = response.data;
      final accessToken = data['accessToken'];
      final refreshToken = data['refreshToken'];
      
      if (accessToken != null) {
        await SecureStorageService.saveAccessToken(accessToken);
      }
      if (refreshToken != null) {
        await SecureStorageService.saveRefreshToken(refreshToken);
      }

      // Fetch user profile from getMe
      final user = await getMe();
      await SecureStorageService.saveUserRole(user.role);
      await SecureStorageService.saveUserId(user.id);
      return user;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Login failed';
    }
  }

  Future<User> getMe() async {
    try {
      // The users endpoint to get self
      final response = await _dio.get('/users/me');
      return User.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch user info';
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {}
    await SecureStorageService.clearAll();
    ApiClient.reset();
  }

  Future<Map<String, dynamic>> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _dio.post('/auth/change-password', data: {
        'oldPassword': oldPassword,
        'newPassword': newPassword,
      });
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to change password';
    }
  }

  Future<Map<String, dynamic>> forgotPassword({required String email}) async {
    try {
      final response = await _publicDio.post('/auth/forgot-password', data: {
        'email': email,
      });
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to request reset link';
    }
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    try {
      final response = await _publicDio.post('/auth/reset-password', data: {
        'email': email,
        'code': code,
        'newPassword': newPassword,
      });
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to reset password';
    }
  }
}