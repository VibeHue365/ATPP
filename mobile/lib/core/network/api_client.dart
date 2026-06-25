import 'dart:io';
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';

class ApiClient {
  static const String baseUrl = 'http://10.0.2.2:3000'; // Android emulator
  // static const String baseUrl = 'http://localhost:3000'; // iOS simulator

  static Dio? _dio;
  static Dio? _publicDio;

  // Authenticated client (auto-refreshes token)
  static Dio get dio {
    _dio ??= _createDio(authenticated: true);
    return _dio!;
  }

  // Public client (no auth)
  static Dio get publicDio {
    _publicDio ??= _createDio(authenticated: false);
    return _publicDio!;
  }

  static Dio _createDio({required bool authenticated}) {
    final d = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        HttpHeaders.contentTypeHeader: 'application/json',
        HttpHeaders.acceptHeader: 'application/json',
      },
    ));

    if (authenticated) {
      d.interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await SecureStorageService.getAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            // Try to refresh token
            final refreshed = await _tryRefreshToken();
            if (refreshed) {
              // Retry original request
              final opts = error.requestOptions;
              final newToken = await SecureStorageService.getAccessToken();
              opts.headers['Authorization'] = 'Bearer $newToken';
              try {
                final response = await dio.fetch(opts);
                handler.resolve(response);
                return;
              } catch (_) {}
            }
          }
          handler.next(error);
        },
      ));
    }

    return d;
  }

  static Future<bool> _tryRefreshToken() async {
    final refreshToken = await SecureStorageService.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      final response = await publicDio.post('/auth/refresh-token', data: {
        'refreshToken': refreshToken,
      });
      final accessToken = response.data['accessToken'];
      final newRefreshToken = response.data['refreshToken'];
      if (accessToken != null) {
        await SecureStorageService.saveAccessToken(accessToken);
        if (newRefreshToken != null) {
          await SecureStorageService.saveRefreshToken(newRefreshToken);
        }
        return true;
      }
    } catch (_) {}
    return false;
  }

  static void reset() {
    _dio = null;
    _publicDio = null;
  }
}